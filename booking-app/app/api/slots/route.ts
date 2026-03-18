import { NextResponse } from "next/server";
import { getSupabasePublic } from "@/lib/supabase";
import { filterSlotsAgainstBlocks, loadBookingBlocksInRange } from "@/lib/booking-blocks";

export const runtime = "nodejs";

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function shiftIsoDate(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const serviceId = url.searchParams.get("serviceId");
    const day = url.searchParams.get("day");
    const tz = url.searchParams.get("tz") || process.env.BOOKING_TIMEZONE || "Europe/Zurich";

    if (!serviceId || !isUuid(serviceId)) {
      return NextResponse.json(
        { error: "Invalid or missing serviceId (UUID expected)." },
        { status: 400 },
      );
    }

    if (!day || !isIsoDate(day)) {
      return NextResponse.json(
        { error: "Invalid or missing day (YYYY-MM-DD expected)." },
        { status: 400 },
      );
    }

    const supabase = getSupabasePublic();

    const variants = [
      { p_service_id: serviceId, p_day: day, p_tz: tz },
      { service_id: serviceId, day, tz },
    ];

    let lastErrorMessage = "Unknown RPC error";
    for (const args of variants) {
      const { data, error } = await supabase.rpc("get_available_slots", args);
      if (!error) {
        const slots = (data ?? []) as Array<{ slot_start: string; slot_end: string }>;
        const rangeStart = `${shiftIsoDate(day, -1)}T00:00:00Z`;
        const rangeEnd = `${shiftIsoDate(day, 2)}T00:00:00Z`;
        const blocks = await loadBookingBlocksInRange({ rangeStart, rangeEnd });
        const filteredSlots = filterSlotsAgainstBlocks(slots, blocks);
        return NextResponse.json({ slots: filteredSlots });
      }
      lastErrorMessage = error.message;
    }

    return NextResponse.json(
      { error: "Failed to load slots", details: lastErrorMessage },
      { status: 500 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Server configuration error", details: (error as Error).message },
      { status: 500 },
    );
  }
}
