import { getSupabaseAdmin } from "@/lib/supabase";

export type BookingBlockRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  label: string | null;
  notes: string | null;
  created_at?: string;
};

function overlaps(startA: string, endA: string, startB: string, endB: string) {
  const aStart = new Date(startA).getTime();
  const aEnd = new Date(endA).getTime();
  const bStart = new Date(startB).getTime();
  const bEnd = new Date(endB).getTime();

  return aStart < bEnd && aEnd > bStart;
}

export async function loadBookingBlocksInRange(args: { rangeStart: string; rangeEnd: string }) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("booking_blocks")
    .select("id, starts_at, ends_at, label, notes, created_at")
    .lt("starts_at", args.rangeEnd)
    .gt("ends_at", args.rangeStart)
    .order("starts_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as BookingBlockRow[];
}

export function filterSlotsAgainstBlocks<
  T extends {
    slot_start: string;
    slot_end: string;
  },
>(slots: T[], blocks: BookingBlockRow[]) {
  return slots.filter(
    (slot) =>
      !blocks.some((block) =>
        overlaps(slot.slot_start, slot.slot_end, block.starts_at, block.ends_at),
      ),
  );
}

export function hasBlockConflict(args: {
  slotStart: string;
  slotEnd: string;
  blocks: BookingBlockRow[];
}) {
  return args.blocks.some((block) =>
    overlaps(args.slotStart, args.slotEnd, block.starts_at, block.ends_at),
  );
}
