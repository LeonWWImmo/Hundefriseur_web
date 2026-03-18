create extension if not exists pgcrypto;

create table if not exists public.booking_blocks (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  label text,
  notes text,
  created_at timestamptz not null default now(),
  constraint booking_blocks_time_check check (ends_at > starts_at)
);

create index if not exists booking_blocks_starts_at_idx on public.booking_blocks (starts_at);
create index if not exists booking_blocks_ends_at_idx on public.booking_blocks (ends_at);
