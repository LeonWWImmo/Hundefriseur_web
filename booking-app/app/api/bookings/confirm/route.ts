import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { Resend } from "resend";

export const runtime = "nodejs";

type ConfirmBody = {
  holdId?: string;
  customerSessionId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  serviceName?: string;
  petName?: string;
  dogSize?: string;
  dogBreed?: string;
  appointmentAt?: string;
  serviceDurationMinutes?: number;
  notes?: string;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normalizeRow(data: unknown) {
  if (Array.isArray(data)) {
    return (data[0] ?? null) as Record<string, unknown> | null;
  }
  return (data ?? null) as Record<string, unknown> | null;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeIcsText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll("\n", "\\n");
}

function toIcsUtc(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${y}${m}${d}T${hh}${mm}${ss}Z`;
}

function getBookingReminderId(booking: Record<string, unknown>, fallbackHoldId: string) {
  const candidates = [
    booking.booking_id,
    booking.id,
    booking.hold_id,
    booking.slot_hold_id,
    fallbackHoldId,
  ];

  for (const candidate of candidates) {
    const value = String(candidate ?? "").trim();
    if (value) return value;
  }

  return fallbackHoldId;
}

async function upsertBookingReminder(args: {
  holdId: string;
  customerEmail: string;
  customerPhone: string;
  serviceName: string;
  petName: string;
  appointmentAt: string;
  booking: Record<string, unknown>;
}) {
  const appointmentIso = String(
    args.booking.starts_at ??
      args.booking.start_at ??
      args.booking.slot_start ??
      args.appointmentAt ??
      "",
  ).trim();

  if (!appointmentIso) {
    return {
      queued: false as const,
      reason: "Missing appointment time for reminder queue.",
    };
  }

  const supabase = getSupabaseAdmin();
  const bookingId = getBookingReminderId(args.booking, args.holdId);

  const { error } = await supabase.from("booking_reminders").upsert(
    {
      booking_id: bookingId,
      customer_email: args.customerEmail,
      customer_phone: args.customerPhone || null,
      pet_name: args.petName || null,
      service_name: args.serviceName || null,
      appointment_at: appointmentIso,
      sent_at: null,
      resend_message_id: null,
      last_error: null,
    },
    {
      onConflict: "booking_id",
    },
  );

  if (error) {
    return {
      queued: false as const,
      reason: error.message,
    };
  }

  return { queued: true as const };
}

async function sendAdminNotificationMail(args: {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceName: string;
  petName: string;
  dogSize: string;
  dogBreed: string;
  appointmentAt: string;
  serviceDurationMinutes: number;
  notes: string;
  holdId: string;
  booking: Record<string, unknown>;
}) {
  const to = (process.env.ADMIN_NOTIFY_EMAIL || "leon.neuhaus@edu.tbz.ch").trim();
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  const from = (process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev").trim();

  if (!apiKey) {
    return {
      sent: false as const,
      reason: "Missing RESEND_API_KEY environment variable.",
    };
  }

  const startIso = String(
    args.booking.starts_at ??
      args.booking.start_at ??
      args.booking.slot_start ??
      args.appointmentAt ??
      "",
  );
  const startDate = new Date(startIso || args.appointmentAt);
  const durationMinutes =
    Number(args.serviceDurationMinutes) > 0 ? Number(args.serviceDurationMinutes) : 60;
  const endIso = String(args.booking.ends_at ?? args.booking.end_at ?? args.booking.slot_end ?? "");
  const endDate = endIso
    ? new Date(endIso)
    : new Date(startDate.getTime() + durationMinutes * 60_000);

  const appointmentLabel =
    !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())
      ? new Intl.DateTimeFormat("de-CH", {
          weekday: "long",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "Europe/Zurich",
        }).format(startDate)
      : "-";

  const notesSafe = args.notes || "-";
  const petSafe = args.petName || "-";
  const serviceSafe = args.serviceName || "-";
  const sizeSafe = args.dogSize || "-";
  const breedSafe = args.dogBreed || "-";

  const uid = `booking-${String(args.booking.booking_id ?? args.holdId)}@pepita-hundecoiffeur.ch`;
  const startLocal = !Number.isNaN(startDate.getTime())
    ? new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Europe/Zurich",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
        .format(startDate)
        .replaceAll("-", "")
        .replace(" ", "T")
        .replaceAll(":", "")
    : "";
  const endLocal = !Number.isNaN(endDate.getTime())
    ? new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Europe/Zurich",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
        .format(endDate)
        .replaceAll("-", "")
        .replace(" ", "T")
        .replaceAll(":", "")
    : "";
  const description = [
    "Neue Buchung",
    "",
    "Kundendaten",
    `Name: ${args.customerName}`,
    `E-Mail: ${args.customerEmail}`,
    `Telefon: ${args.customerPhone}`,
    "",
    "Hund",
    `Name: ${petSafe}`,
    `Groesse: ${sizeSafe}`,
    `Rasse: ${breedSafe}`,
    "",
    "Hinweise",
    `${notesSafe}`,
  ].join("\n");
  const ics = [
    "BEGIN:VCALENDAR",
    "PRODID:-//Hundecoiffeur Pepita//Booking//DE",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VTIMEZONE",
    "TZID:Europe/Zurich",
    "X-LIC-LOCATION:Europe/Zurich",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0200",
    "TZNAME:CEST",
    "DTSTART:19700329T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0200",
    "TZOFFSETTO:+0100",
    "TZNAME:CET",
    "DTSTART:19701025T030000",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtc(new Date())}`,
    `DTSTART;TZID=Europe/Zurich:${startLocal}`,
    `DTEND;TZID=Europe/Zurich:${endLocal}`,
    `SUMMARY:${escapeIcsText(`Buchung: ${serviceSafe} (${sizeSafe})`)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    "LOCATION:Hundecoiffeur Pepita",
    "TRANSP:OPAQUE",
    "CLASS:PUBLIC",
    `ORGANIZER;CN=Hundecoiffeur Pepita:MAILTO:${from}`,
    `ATTENDEE;CN=Leon Neuhaus;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:MAILTO:${to}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Erinnerung: Buchung in 2 Stunden",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const html = `
  <div style="font-family:Inter,Arial,sans-serif;background:#f8f7f5;padding:20px;">
    <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #f3e6d8;border-radius:14px;overflow:hidden;">
      <div style="background:linear-gradient(90deg,#f97316,#fb923c);padding:16px 20px;color:#ffffff;">
        <h2 style="margin:0;font-size:20px;">Neue Buchung eingegangen</h2>
      </div>
      <div style="padding:18px 20px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#64748b;">Service</td><td style="padding:8px 0;font-weight:700;color:#0f172a;">${escapeHtml(serviceSafe)}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">Groesse</td><td style="padding:8px 0;font-weight:700;color:#0f172a;">${escapeHtml(sizeSafe)}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">Termin</td><td style="padding:8px 0;font-weight:700;color:#0f172a;">${escapeHtml(appointmentLabel)}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">Name</td><td style="padding:8px 0;color:#0f172a;">${escapeHtml(args.customerName)}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">E-Mail</td><td style="padding:8px 0;color:#0f172a;">${escapeHtml(args.customerEmail)}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">Telefon</td><td style="padding:8px 0;color:#0f172a;">${escapeHtml(args.customerPhone)}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">Hundename</td><td style="padding:8px 0;color:#0f172a;">${escapeHtml(petSafe)}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;">Rasse</td><td style="padding:8px 0;color:#0f172a;">${escapeHtml(breedSafe)}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b;vertical-align:top;">Notiz</td><td style="padding:8px 0;color:#0f172a;white-space:pre-wrap;">${escapeHtml(notesSafe)}</td></tr>
        </table>
      </div>
    </div>
  </div>`;

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: [to],
    subject: "Neue Buchung eingegangen",
    html,
    attachments: [
      {
        filename: "termin-einladung.ics",
        content: Buffer.from(ics, "utf8").toString("base64"),
      },
    ],
    text: [
      "Neue Buchung",
      `Service: ${serviceSafe}`,
      `Groesse: ${sizeSafe}`,
      `Termin: ${appointmentLabel}`,
      `Name: ${args.customerName}`,
      `E-Mail: ${args.customerEmail}`,
      `Telefon: ${args.customerPhone}`,
      `Hund: ${petSafe}`,
      `Rasse: ${breedSafe}`,
      `Notiz: ${notesSafe}`,
    ].join("\n"),
  });

  if (error) {
    return {
      sent: false as const,
      reason: `Resend error: ${error.message}`,
    };
  }

  return { sent: true as const };
}

async function sendCustomerConfirmationMail(args: {
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  petName: string;
  appointmentAt: string;
  booking: Record<string, unknown>;
}) {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  const from = (process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev").trim();
  const contactEmail = (process.env.REMINDER_CONTACT_EMAIL || "coiffeur.pepita@gmail.com").trim();
  const contactPhone = (process.env.REMINDER_CONTACT_PHONE || "076 774 08 22").trim();
  const address = (
    process.env.REMINDER_ADDRESS || "Zugerstrasse 90, 8810 Horgen"
  ).trim();

  if (!apiKey) {
    return {
      sent: false as const,
      reason: "Missing RESEND_API_KEY environment variable.",
    };
  }

  const appointmentIso = String(
    args.booking.starts_at ??
      args.booking.start_at ??
      args.booking.slot_start ??
      args.appointmentAt ??
      "",
  ).trim();
  const appointmentDate = new Date(appointmentIso || args.appointmentAt);

  const dateLabel = !Number.isNaN(appointmentDate.getTime())
    ? new Intl.DateTimeFormat("de-CH", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "Europe/Zurich",
      }).format(appointmentDate)
    : "-";

  const timeLabel = !Number.isNaN(appointmentDate.getTime())
    ? new Intl.DateTimeFormat("de-CH", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Europe/Zurich",
      }).format(appointmentDate)
    : "-";

  const serviceSafe = args.serviceName || "-";
  const petSafe = args.petName || "-";

  const html = `
  <div style="font-family:Arial,sans-serif;background:#f8f7f5;padding:20px;color:#111827;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #f3e6d8;border-radius:14px;overflow:hidden;">
      <div style="background:linear-gradient(90deg,#f97316,#fb923c);padding:16px 20px;color:#ffffff;">
        <h1 style="margin:0;font-size:20px;">Ihre Buchung wurde eingetragen</h1>
      </div>
      <div style="padding:20px;">
        <p style="margin-top:0;">Dies ist eine automatisch generierte E-Mail.</p>
        <p>Ihre Buchung wurde erfolgreich in unserem System eingetragen.</p>
        <p>Bei Fragen oder falls Sie den Termin nicht wahrnehmen können, melden Sie sich bitte bei ${escapeHtml(contactEmail)} oder ${escapeHtml(contactPhone)}.</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#6b7280;">Datum</td><td style="padding:8px 0;font-weight:700;">${escapeHtml(dateLabel)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Uhrzeit</td><td style="padding:8px 0;font-weight:700;">${escapeHtml(timeLabel)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Service</td><td style="padding:8px 0;font-weight:700;">${escapeHtml(serviceSafe)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Hundename</td><td style="padding:8px 0;font-weight:700;">${escapeHtml(petSafe)}</td></tr>
          <tr><td style="padding:8px 0;color:#6b7280;">Adresse</td><td style="padding:8px 0;font-weight:700;">${escapeHtml(address)}</td></tr>
        </table>
        <p style="margin-bottom:0;">Freundliche Grüsse<br />Hundecoiffeur Pepita</p>
      </div>
    </div>
  </div>`;

  const text = [
    "Dies ist eine automatisch generierte E-Mail.",
    "",
    "Ihre Buchung wurde erfolgreich in unserem System eingetragen.",
    "",
    `Datum: ${dateLabel}`,
    `Uhrzeit: ${timeLabel}`,
    `Service: ${serviceSafe}`,
    `Hundename: ${petSafe}`,
    `Adresse: ${address}`,
    "",
    `Bei Fragen oder falls Sie den Termin nicht wahrnehmen können, melden Sie sich bitte bei ${contactEmail} oder ${contactPhone}.`,
    "",
    "Freundliche Grüsse",
    "Hundecoiffeur Pepita",
  ].join("\n");

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: [args.customerEmail],
    subject: "Ihre Buchung bei Hundecoiffeur Pepita",
    html,
    text,
  });

  if (error) {
    return {
      sent: false as const,
      reason: `Resend error: ${error.message}`,
    };
  }

  return { sent: true as const };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as ConfirmBody;

    const holdId = payload.holdId?.trim() ?? "";
    const customerSessionId = payload.customerSessionId?.trim() ?? "";
    const customerName = payload.customerName?.trim() ?? "";
    const customerEmail = payload.customerEmail?.trim() ?? "";
    const customerPhone = payload.customerPhone?.trim() ?? "";
    const serviceName = payload.serviceName?.trim() ?? "";
    const petName = payload.petName?.trim() ?? "";
    const dogSize = payload.dogSize?.trim() ?? "";
    const dogBreed = payload.dogBreed?.trim() ?? "";
    const appointmentAt = payload.appointmentAt?.trim() ?? "";
    const serviceDurationMinutes = Number(payload.serviceDurationMinutes ?? 0);
    const notes = payload.notes?.trim() ?? "";
    const notesForDb = [notes, dogBreed ? `Rasse: ${dogBreed}` : ""]
      .filter(Boolean)
      .join("\n");

    if (!holdId || !isUuid(holdId)) {
      return NextResponse.json(
        { error: "Invalid or missing holdId (UUID expected)." },
        { status: 400 },
      );
    }

    if (!customerSessionId) {
      return NextResponse.json(
        { error: "Invalid or missing customerSessionId." },
        { status: 400 },
      );
    }

    if (!customerName) {
      return NextResponse.json({ error: "customerName is required." }, { status: 400 });
    }

    if (!customerEmail || !isEmail(customerEmail)) {
      return NextResponse.json(
        { error: "Invalid or missing customerEmail." },
        { status: 400 },
      );
    }

    if (!customerPhone) {
      return NextResponse.json(
        { error: "customerPhone is required." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("confirm_booking", {
      p_hold_id: holdId,
      p_customer_session_id: customerSessionId,
      p_customer_name: customerName,
      p_customer_email: customerEmail,
      p_customer_phone: customerPhone,
      p_pet_name: petName || null,
      p_notes: notesForDb || null,
    });

    if (error) {
      return NextResponse.json(
        { error: "Failed to confirm booking", details: error.message },
        { status: 500 },
      );
    }

    const booking = normalizeRow(data);
    if (!booking) {
      return NextResponse.json({ error: "Confirm RPC returned no data." }, { status: 500 });
    }

    const reminderResult = await upsertBookingReminder({
      holdId,
      customerEmail,
      customerPhone,
      serviceName,
      petName,
      appointmentAt,
      booking,
    }).catch((error) => ({
      queued: false as const,
      reason: (error as Error).message,
    }));

    const mailResult = await sendAdminNotificationMail({
      customerName,
      customerEmail,
      customerPhone,
      serviceName,
      petName,
      dogSize,
      dogBreed,
      appointmentAt,
      serviceDurationMinutes,
      notes,
      holdId,
      booking,
    }).catch((error) => ({
      sent: false as const,
      reason: (error as Error).message,
    }));

    const customerMailResult = await sendCustomerConfirmationMail({
      customerEmail,
      customerName,
      customerPhone,
      serviceName,
      petName,
      appointmentAt,
      booking,
    }).catch((error) => ({
      sent: false as const,
      reason: (error as Error).message,
    }));

    return NextResponse.json({
      booking,
      reminderQueued: reminderResult.queued,
      reminderQueueError: reminderResult.queued ? null : reminderResult.reason,
      notifyMailSent: mailResult.sent,
      notifyMailError: mailResult.sent ? null : mailResult.reason,
      notifyMailTo: (process.env.ADMIN_NOTIFY_EMAIL || "leon.neuhaus@edu.tbz.ch").trim(),
      customerMailSent: customerMailResult.sent,
      customerMailError: customerMailResult.sent ? null : customerMailResult.reason,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Server configuration error", details: (error as Error).message },
      { status: 500 },
    );
  }
}
