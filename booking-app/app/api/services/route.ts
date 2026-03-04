import { NextResponse } from "next/server";
import { getSupabasePublic } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = getSupabasePublic();
    const { data, error } = await supabase
      .from("services")
      .select("id, name, duration_minutes, price_chf")
      .eq("active", true)
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: "Failed to load services", details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ services: data ?? [] });
  } catch (error) {
    return NextResponse.json(
      { error: "Server configuration error", details: (error as Error).message },
      { status: 500 },
    );
  }
}
