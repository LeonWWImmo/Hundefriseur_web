-- Montag von 13:00 auf 10:30 und 14:30 umstellen
-- Altregel endet am 2026-04-26, neue Regeln gelten ab 2026-04-27.

update public.availability_slot_rules
set valid_until = '2026-04-26'
where day_of_week = 1
  and start_time = '13:00:00'
  and valid_until is null;

insert into public.availability_slot_rules (
  day_of_week,
  start_time,
  buffer_minutes,
  active,
  valid_from,
  valid_until
)
select 1, '10:30:00', 0, true, '2026-04-27', null
where not exists (
  select 1
  from public.availability_slot_rules
  where day_of_week = 1
    and start_time = '10:30:00'
    and valid_from = '2026-04-27'
    and valid_until is null
);

insert into public.availability_slot_rules (
  day_of_week,
  start_time,
  buffer_minutes,
  active,
  valid_from,
  valid_until
)
select 1, '14:30:00', 0, true, '2026-04-27', null
where not exists (
  select 1
  from public.availability_slot_rules
  where day_of_week = 1
    and start_time = '14:30:00'
    and valid_from = '2026-04-27'
    and valid_until is null
);
