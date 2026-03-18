import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, requireAdminSession } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

type CreateBlockBody = {
  ranges?: Array<{
    startsAt?: string;
    endsAt?: string;
  }>;
  label?: string;
  notes?: string;
};

function isIsoTimestamp(value: string) {
  return !Number.isNaN(Date.parse(value));
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const guard = await requireAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const url = new URL(request.url);
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    const upcomingOnly = url.searchParams.get("upcomingOnly") === "true";

    const supabase = getSupabaseAdmin();

    if (upcomingOnly) {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("booking_blocks")
        .select("id, starts_at, ends_at, label, notes, created_at")
        .gt("ends_at", nowIso)
        .order("starts_at", { ascending: true });

      if (error) {
        return NextResponse.json(
          { error: "Failed to load booking blocks", details: error.message },
          { status: 500 },
        );
      }

      return NextResponse.json({ blocks: data ?? [] });
    }

    if (!isIsoTimestamp(from) || !isIsoTimestamp(to)) {
      return NextResponse.json(
        { error: "Invalid from/to range." },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("booking_blocks")
      .select("id, starts_at, ends_at, label, notes, created_at")
      .lt("starts_at", to)
      .gt("ends_at", from)
      .order("starts_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Failed to load booking blocks", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ blocks: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: "Server configuration error", details: (error as Error).message },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const guard = await requireAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  try {
    const payload = (await request.json()) as CreateBlockBody;
    const ranges = (payload.ranges ?? []).filter(Boolean);
    const label = payload.label?.trim() || null;
    const notes = payload.notes?.trim() || null;

    if (ranges.length === 0) {
      return NextResponse.json(
        { error: "At least one range is required." },
        { status: 400 },
      );
    }

    const inserts = ranges.map((range) => {
      const startsAt = range.startsAt?.trim() ?? "";
      const endsAt = range.endsAt?.trim() ?? "";

      if (!isIsoTimestamp(startsAt) || !isIsoTimestamp(endsAt)) {
        throw new Error("Each range requires valid startsAt and endsAt values.");
      }

      if (new Date(startsAt).getTime() >= new Date(endsAt).getTime()) {
        throw new Error("Range end must be after range start.");
      }

      return {
        starts_at: startsAt,
        ends_at: endsAt,
        label,
        notes,
      };
    });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("booking_blocks")
      .insert(inserts)
      .select("id, starts_at, ends_at, label, notes, created_at")
      .order("starts_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Failed to create booking blocks", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ blocks: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: "Invalid request", details: (error as Error).message },
      { status: 400 },
    );
  }
}
