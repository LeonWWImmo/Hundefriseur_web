import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { hasBlockConflict, loadBookingBlocksInRange } from "@/lib/booking-blocks";

export const runtime = "nodejs";

type CreateHoldBody = {
  serviceId?: string;
  slotStart?: string;
  customerSessionId?: string;
  holdMinutes?: number;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isIsoTimestamp(value: string) {
  const parsed = Date.parse(value);
  return !Number.isNaN(parsed);
}

function normalizeRow(data: unknown) {
  if (Array.isArray(data)) {
    return (data[0] ?? null) as Record<string, unknown> | null;
  }
  return (data ?? null) as Record<string, unknown> | null;
}

function toIsoDate(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CreateHoldBody;
    const serviceId = payload.serviceId?.trim() ?? "";
    const slotStart = payload.slotStart?.trim() ?? "";
    const customerSessionId = payload.customerSessionId?.trim() ?? "";
    const holdMinutes = Number.isFinite(payload.holdMinutes)
      ? Number(payload.holdMinutes)
      : Number(process.env.BOOKING_HOLD_MINUTES || 10);

    if (!serviceId || !isUuid(serviceId)) {
      return NextResponse.json(
        { error: "Invalid or missing serviceId (UUID expected)." },
        { status: 400 },
      );
    }

    if (!slotStart || !isIsoTimestamp(slotStart)) {
      return NextResponse.json(
        { error: "Invalid or missing slotStart (ISO timestamp expected)." },
        { status: 400 },
      );
    }

    if (!customerSessionId) {
      return NextResponse.json(
        { error: "Invalid or missing customerSessionId." },
        { status: 400 },
      );
    }

    if (!Number.isInteger(holdMinutes) || holdMinutes < 1 || holdMinutes > 120) {
      return NextResponse.json(
        { error: "Invalid holdMinutes (1-120 expected)." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const slotDay = toIsoDate(slotStart);
    const slotVariants = [
      { p_service_id: serviceId, p_day: slotDay, p_tz: process.env.BOOKING_TIMEZONE || "Europe/Zurich" },
      { service_id: serviceId, day: slotDay, tz: process.env.BOOKING_TIMEZONE || "Europe/Zurich" },
    ];

    let requestedSlot: { slot_start: string; slot_end: string } | null = null;
    for (const args of slotVariants) {
      const { data, error } = await supabase.rpc("get_available_slots", args);
      if (error) continue;
      requestedSlot =
        ((data ?? []) as Array<{ slot_start: string; slot_end: string }>).find(
          (item) => item.slot_start === slotStart,
        ) ?? null;
      if (requestedSlot) break;
    }

    const slotStartDate = new Date(slotStart);
    const slotEndDate = requestedSlot
      ? new Date(requestedSlot.slot_end)
      : new Date(slotStartDate.getTime() + holdMinutes * 60_000);
    const blocks = await loadBookingBlocksInRange({
      rangeStart: slotStartDate.toISOString(),
      rangeEnd: slotEndDate.toISOString(),
    });

    if (
      hasBlockConflict({
        slotStart: slotStartDate.toISOString(),
        slotEnd: slotEndDate.toISOString(),
        blocks,
      })
    ) {
      return NextResponse.json(
        { error: "Dieser Zeitraum ist fuer Admin gesperrt." },
        { status: 409 },
      );
    }

    const { data, error } = await supabase.rpc("create_booking_hold", {
      p_service_id: serviceId,
      p_slot_start: slotStart,
      p_customer_session_id: customerSessionId,
      p_hold_minutes: holdMinutes,
    });

    if (error) {
      return NextResponse.json(
        { error: "Failed to create hold", details: error.message },
        { status: 500 },
      );
    }

    const hold = normalizeRow(data);
    if (!hold) {
      return NextResponse.json({ error: "Hold RPC returned no data." }, { status: 500 });
    }

    return NextResponse.json({ hold });
  } catch (error) {
    return NextResponse.json(
      { error: "Server configuration error", details: (error as Error).message },
      { status: 500 },
    );
  }
}
