type ReminderRow = {
  id: string;
  booking_id: string;
  customer_email: string;
  customer_phone: string | null;
  pet_name: string | null;
  service_name: string | null;
  appointment_at: string;
};

const TZ = "Europe/Zurich";

function requireEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function formatYmdInTz(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(date);
}

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function lastSundayOfMonth(year: number, monthIndex: number) {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0));
  return lastDay.getUTCDate() - lastDay.getUTCDay();
}

function getZurichOffset(dateKey: string, time: string) {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split("-");
  const [hourRaw] = time.split(":");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Number(hourRaw);
  const marchSwitch = lastSundayOfMonth(year, 2);
  const octoberSwitch = lastSundayOfMonth(year, 9);

  const afterMarchSwitch =
    month > 3 || (month === 3 && (day > marchSwitch || (day === marchSwitch && hour >= 2)));
  const beforeOctoberSwitch =
    month < 10 || (month === 10 && (day < octoberSwitch || (day === octoberSwitch && hour < 3)));

  return afterMarchSwitch && beforeOctoberSwitch ? "+02:00" : "+01:00";
}

function toZurichIso(dateKey: string, time: string) {
  return `${dateKey}T${time}:00${getZurichOffset(dateKey, time)}`;
}

function tomorrowWindowInZurich(now: Date) {
  const todayInZurich = formatYmdInTz(now, TZ);
  const tomorrow = addDays(todayInZurich, 1);
  return {
    start: toZurichIso(tomorrow, "00:00"),
    end: toZurichIso(addDays(tomorrow, 1), "00:00"),
    label: tomorrow,
  };
}

function buildReminderHtml(args: {
  petName: string;
  serviceName: string;
  appointmentAt: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
}) {
  const appointmentDate = new Date(args.appointmentAt);
  const dateLabel = new Intl.DateTimeFormat("de-CH", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TZ,
  }).format(appointmentDate);
  const timeLabel = new Intl.DateTimeFormat("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  }).format(appointmentDate);

  return `
  <div style="font-family:Arial,sans-serif;background:#f8f7f5;padding:20px;color:#111827;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #f3e6d8;border-radius:14px;overflow:hidden;">
      <div style="background:linear-gradient(90deg,#f97316,#fb923c);padding:16px 20px;color:#ffffff;">
        <h1 style="margin:0;font-size:20px;">Erinnerung an Ihren Termin morgen</h1>
      </div>
      <div style="padding:20px;">
        <p style="margin-top:0;">Dies ist eine automatisch generierte E-Mail. Bei Fragen melden Sie sich bitte bei ${args.contactEmail} oder ${args.contactPhone}.</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#6b7280;">Hundename</td><td style="padding:8px 0;font-weight:700;">${args.petName}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Service</td><td style="padding:8px 0;font-weight:700;">${args.serviceName}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Datum</td><td style="padding:8px 0;font-weight:700;">${dateLabel}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Uhrzeit</td><td style="padding:8px 0;font-weight:700;">${timeLabel}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Adresse</td><td style="padding:8px 0;font-weight:700;">${args.address}</td></tr>
        </table>
        <p style="margin-bottom:0;color:#6b7280;">Falls es Probleme gibt oder Sie den Termin nicht wahrnehmen koennen, rufen Sie uns bitte unter ${args.contactPhone} an.</p>
      </div>
    </div>
  </div>`;
}

function buildReminderText(args: {
  petName: string;
  serviceName: string;
  appointmentAt: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
}) {
  const appointmentDate = new Date(args.appointmentAt);
  const dateLabel = new Intl.DateTimeFormat("de-CH", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TZ,
  }).format(appointmentDate);
  const timeLabel = new Intl.DateTimeFormat("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TZ,
  }).format(appointmentDate);

  return [
    "Dies ist eine automatisch generierte E-Mail.",
    `Bei Fragen melden Sie sich bitte bei ${args.contactEmail} oder ${args.contactPhone}.`,
    "",
    `Hundename: ${args.petName}`,
    `Service: ${args.serviceName}`,
    `Datum: ${dateLabel}`,
    `Uhrzeit: ${timeLabel}`,
    `Adresse: ${args.address}`,
    "",
    `Falls es Probleme gibt oder Sie den Termin nicht wahrnehmen koennen, rufen Sie uns bitte unter ${args.contactPhone} an.`,
  ].join("\n");
}

async function resendEmail(args: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: args.from,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload?.message === "string" ? payload.message : `Resend error (${response.status})`,
    );
  }

  return String(payload.id ?? "");
}

Deno.serve(async () => {
  try {
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = requireEnv("RESEND_API_KEY");
    const resendFrom = requireEnv("RESEND_FROM_EMAIL");
    const contactEmail = requireEnv("REMINDER_CONTACT_EMAIL");
    const contactPhone = requireEnv("REMINDER_CONTACT_PHONE");
    const address = requireEnv("REMINDER_ADDRESS");

    const window = tomorrowWindowInZurich(new Date());

    const remindersResponse = await fetch(
      `${supabaseUrl}/rest/v1/booking_reminders?select=id,booking_id,customer_email,customer_phone,pet_name,service_name,appointment_at&sent_at=is.null&appointment_at=gte.${encodeURIComponent(window.start)}&appointment_at=lt.${encodeURIComponent(window.end)}`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      },
    );

    const reminders = (await remindersResponse.json().catch(() => [])) as ReminderRow[];
    if (!remindersResponse.ok) {
      throw new Error(`Failed to load reminders: ${JSON.stringify(reminders)}`);
    }

    let sent = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const reminder of reminders) {
      try {
        const petName = reminder.pet_name?.trim() || "-";
        const serviceName = reminder.service_name?.trim() || "-";
        const html = buildReminderHtml({
          petName,
          serviceName,
          appointmentAt: reminder.appointment_at,
          contactEmail,
          contactPhone,
          address,
        });
        const text = buildReminderText({
          petName,
          serviceName,
          appointmentAt: reminder.appointment_at,
          contactEmail,
          contactPhone,
          address,
        });

        const resendMessageId = await resendEmail({
          apiKey: resendApiKey,
          from: resendFrom,
          to: reminder.customer_email,
          subject: "Erinnerung an Ihren Termin morgen",
          html,
          text,
        });

        await fetch(`${supabaseUrl}/rest/v1/booking_reminders?id=eq.${reminder.id}`, {
          method: "PATCH",
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            sent_at: new Date().toISOString(),
            resend_message_id: resendMessageId || null,
            last_error: null,
          }),
        });

        sent += 1;
      } catch (error) {
        const message = (error as Error).message;
        errors.push({ id: reminder.id, error: message });

        await fetch(`${supabaseUrl}/rest/v1/booking_reminders?id=eq.${reminder.id}`, {
          method: "PATCH",
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            last_error: message,
          }),
        });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        targetDate: window.label,
        processed: reminders.length,
        sent,
        errors,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: (error as Error).message,
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
