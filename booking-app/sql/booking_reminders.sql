create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create extension if not exists pg_net;

create table if not exists public.booking_reminders (
  id uuid primary key default gen_random_uuid(),
  booking_id text not null unique,
  customer_email text not null,
  customer_phone text,
  pet_name text,
  service_name text,
  appointment_at timestamptz not null,
  sent_at timestamptz,
  resend_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_reminders_appointment_at_idx
  on public.booking_reminders (appointment_at);

create index if not exists booking_reminders_sent_at_idx
  on public.booking_reminders (sent_at);

create or replace function public.set_booking_reminders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists booking_reminders_set_updated_at on public.booking_reminders;

create trigger booking_reminders_set_updated_at
before update on public.booking_reminders
for each row
execute function public.set_booking_reminders_updated_at();

-- Setup notes:
-- 1. In Supabase Secrets set:
--    RESEND_API_KEY
--    RESEND_FROM_EMAIL
--    REMINDER_CONTACT_EMAIL
--    REMINDER_CONTACT_PHONE
--    REMINDER_ADDRESS
-- 2. Deploy the edge function: send-booking-reminders
-- 3. Store your service role key in Vault, then schedule the cron job:
--
-- select vault.create_secret('YOUR_SUPABASE_SERVICE_ROLE_KEY', 'service_role_key');
--
-- select cron.schedule(
--   'send-booking-reminders-daily-0600',
--   '0 6 * * *',
--   $$
--   select
--     net.http_post(
--       url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-booking-reminders',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer ' || (
--           select decrypted_secret
--           from vault.decrypted_secrets
--           where name = 'service_role_key'
--         )
--       ),
--       body := jsonb_build_object('trigger', 'cron')
--     ) as request_id;
--   $$
-- );
