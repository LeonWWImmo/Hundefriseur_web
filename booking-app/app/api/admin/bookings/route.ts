import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase";
import { ADMIN_SESSION_COOKIE, requireAdminSession } from "@/lib/admin-auth";

export const runtime = "nodejs";

type BookingRow = {
  id: string;
  starts_at: string;
  ends_at: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  pet_name: string | null;
  notes: string | null;
  created_at: string;
};

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const guard = await requireAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    const { searchParams } = new URL(request.url);
    const from = (searchParams.get("from") || "").trim();
    const to = (searchParams.get("to") || "").trim();

    if (!isIsoDate(from) || !isIsoDate(to)) {
      return NextResponse.json({ error: "Invalid or missing date range." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("bookings")
      .select("id,starts_at,ends_at,customer_name,customer_email,customer_phone,pet_name,notes,created_at")
      .gte("starts_at", `${from}T00:00:00+01:00`)
      .lt("starts_at", `${to}T00:00:00+01:00`)
      .order("starts_at", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Failed to load bookings", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ bookings: (data ?? []) as BookingRow[] });
  } catch (error) {
    return NextResponse.json(
      { error: "Server error", details: (error as Error).message },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const guard = await requireAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
    if (!guard.ok) {
      return NextResponse.json({ error: guard.error }, { status: guard.status });
    }

    const { bookingId } = (await request.json().catch(() => ({}))) as { bookingId?: string };
    const id = String(bookingId ?? "").trim();

    if (!id) {
      return NextResponse.json({ error: "Missing bookingId." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { error: bookingError } = await supabase.from("bookings").delete().eq("id", id);
    if (bookingError) {
      return NextResponse.json(
        { error: "Failed to delete booking", details: bookingError.message },
        { status: 500 },
      );
    }

    const { error: reminderError } = await supabase
      .from("booking_reminders")
      .delete()
      .eq("booking_id", id);

    if (reminderError) {
      return NextResponse.json(
        {
          error: "Booking deleted but reminder cleanup failed",
          details: reminderError.message,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Server error", details: (error as Error).message },
      { status: 500 },
    );
  }
}
