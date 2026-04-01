"use client";

import { useEffect, useMemo, useState } from "react";
import AdminMenu from "../_components/AdminMenu";
import styles from "../kalender/page.module.css";

type BookingItem = {
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

type DayItem = {
  iso: string;
  label: string;
  dateLabel: string;
};

const TZ = "Europe/Zurich";

const weekdayFmt = new Intl.DateTimeFormat("de-CH", { weekday: "short", timeZone: TZ });
const dateFmt = new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit", timeZone: TZ });
const ymdFmt = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: TZ,
});
const timeFmt = new Intl.DateTimeFormat("de-CH", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: TZ,
});
const dateTimeFmt = new Intl.DateTimeFormat("de-CH", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: TZ,
});

function toIsoDate(date: Date) {
  return ymdFmt.format(date);
}

function todayIso() {
  return toIsoDate(new Date());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeekMonday(isoDay: string) {
  const date = new Date(`${isoDay}T12:00:00`);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function currentWeekMondayIso() {
  return toIsoDate(startOfWeekMonday(todayIso()));
}

function buildWeek(weekStartIso: string): DayItem[] {
  const monday = startOfWeekMonday(weekStartIso);
  return [0, 1, 2, 3, 4, 5].map((offset) => {
    const date = addDays(monday, offset);
    return {
      iso: toIsoDate(date),
      label: weekdayFmt.format(date),
      dateLabel: dateFmt.format(date),
    };
  });
}

function parseBookingNotes(notes: string | null) {
  const raw = (notes || "").trim();
  if (!raw) {
    return { noteText: "-", breed: "-" };
  }

  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let breed = "-";
  const noteLines: string[] = [];

  for (const line of lines) {
    const match = /^Rasse:\s*(.+)$/i.exec(line);
    if (match) {
      breed = match[1]?.trim() || "-";
      continue;
    }
    noteLines.push(line);
  }

  return {
    noteText: noteLines.length > 0 ? noteLines.join(" ") : "-",
    breed,
  };
}

export default function BookingsManager() {
  const [weekStartIso, setWeekStartIso] = useState(() => currentWeekMondayIso());
  const [bookingsByDay, setBookingsByDay] = useState<Record<string, BookingItem[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const weekDays = useMemo(() => buildWeek(weekStartIso), [weekStartIso]);
  const todayStartMs = new Date(`${todayIso()}T00:00:00`).getTime();

  useEffect(() => {
    async function loadBookings() {
      if (weekDays.length === 0) return;

      setLoading(true);
      setError("");
      setSuccess("");

      const from = weekDays[0]?.iso;
      const lastDay = weekDays[weekDays.length - 1]?.iso;
      const to = lastDay ? toIsoDate(addDays(new Date(`${lastDay}T12:00:00`), 1)) : from;
      const params = new URLSearchParams({ from, to });
      const response = await fetch(`/api/admin/bookings?${params.toString()}`);
      const payload = (await response.json().catch(() => ({}))) as {
        bookings?: BookingItem[];
        error?: string;
        details?: string;
      };

      if (!response.ok) {
        const message = payload.details ? `${payload.error}: ${payload.details}` : payload.error;
        setError(message || "Buchungen konnten nicht geladen werden.");
        setBookingsByDay({});
        setLoading(false);
        return;
      }

      const next: Record<string, BookingItem[]> = {};
      for (const day of weekDays) {
        next[day.iso] = [];
      }

      for (const booking of payload.bookings ?? []) {
        if (new Date(booking.starts_at).getTime() < todayStartMs) {
          continue;
        }
        const key = ymdFmt.format(new Date(booking.starts_at));
        if (!next[key]) next[key] = [];
        next[key].push(booking);
      }

      for (const key of Object.keys(next)) {
        next[key].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
      }

      setBookingsByDay(next);
      setLoading(false);
    }

    void loadBookings();
  }, [todayStartMs, weekDays]);

  function shiftWeek(direction: -1 | 1) {
    const shifted = addDays(startOfWeekMonday(weekStartIso), direction * 7);
    setWeekStartIso(toIsoDate(shifted));
  }

  function jumpToCurrentWeek() {
    setWeekStartIso(currentWeekMondayIso());
  }

  const allBookings = useMemo(
    () =>
      Object.values(bookingsByDay)
        .flat()
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [bookingsByDay],
  );

  const selectedBooking = allBookings.find((booking) => booking.id === selectedBookingId) ?? null;
  const selectedBookingNotes = selectedBooking ? parseBookingNotes(selectedBooking.notes) : null;

  async function deleteSelectedBooking() {
    if (!selectedBooking) return;

    setDeleting(true);
    setError("");
    setSuccess("");

    const response = await fetch("/api/admin/bookings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId: selectedBooking.id }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      details?: string;
    };

    if (!response.ok) {
      const message = payload.details ? `${payload.error}: ${payload.details}` : payload.error;
      setError(message || "Buchung konnte nicht gelöscht werden.");
      setDeleting(false);
      setConfirmDeleteOpen(false);
      return;
    }

    setBookingsByDay((current) => {
      const next: Record<string, BookingItem[]> = {};
      for (const [key, values] of Object.entries(current)) {
        next[key] = values.filter((booking) => booking.id !== selectedBooking.id);
      }
      return next;
    });
    setSelectedBookingId("");
    setDeleting(false);
    setConfirmDeleteOpen(false);
    setSuccess("Buchung gelöscht. Der Slot ist wieder frei.");
  }

  const totalBookings = allBookings.length;

  return (
    <div className={styles.manager}>
      <section className={styles.controlsCard}>
        <div className={styles.toolbar}>
          <div>
            <p className={styles.kicker}>Admin Bereich</p>
            <h1>Buchungen</h1>
          </div>

          <div className={styles.toolbarActions}>
            <AdminMenu currentPath="/admin/buchungen" />
          </div>
        </div>

        <div className={styles.setupGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2>Gebuchte Slots</h2>
              <p>{loading ? "Buchungen werden geladen..." : `${totalBookings} Einträge in dieser Woche`}</p>
            </div>

            <div className={styles.bulkActions}>
              <button type="button" className={styles.secondaryBtn} onClick={jumpToCurrentWeek}>
                Heute
              </button>
              <button type="button" className={styles.secondaryBtn} onClick={() => shiftWeek(-1)}>
                Vorherige Woche
              </button>
              <button type="button" className={styles.secondaryBtn} onClick={() => shiftWeek(1)}>
                Nächste Woche
              </button>
            </div>

            {error ? <p className={styles.error}>{error}</p> : null}
            {success ? <p className={styles.success}>{success}</p> : null}

            <div className={styles.weekHeader}>
              {weekDays.map((day) => (
                <div key={day.iso} className={styles.weekDayHead}>
                  <p>{day.label}</p>
                  <strong>{day.dateLabel}</strong>
                </div>
              ))}
            </div>

            <div className={styles.calendarGrid}>
              {weekDays.map((day) => {
                const bookings = bookingsByDay[day.iso] || [];
                return (
                  <div
                    key={day.iso}
                    className={`${styles.dayCell} ${bookings.length === 0 ? styles.dayCellUnavailable : ""}`.trim()}
                  >
                    <div className={styles.dayToggle}>
                      <small className={styles.dayDateInline}>
                        {day.label} {day.dateLabel}
                      </small>
                    </div>

                    <div className={styles.slotPills}>
                      {bookings.length === 0 ? <div className={styles.slotEmpty}>Keine Buchungen</div> : null}
                      {bookings.map((booking) => {
                        const selected = selectedBookingId === booking.id;
                        return (
                          <button
                            key={booking.id}
                            type="button"
                            className={`${styles.slotPill} ${styles.bookingPill} ${selected ? styles.bookingPillActive : ""}`.trim()}
                            onClick={() => setSelectedBookingId(booking.id)}
                          >
                            <strong>{timeFmt.format(new Date(booking.starts_at))}</strong>
                            <span>{booking.pet_name || "Ohne Hundename"}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2>Buchungsdetails</h2>
              <p>{selectedBooking ? "Ausgewählter Eintrag" : "Kein Slot ausgewählt"}</p>
            </div>

            {!selectedBooking ? (
              <p className={styles.emptyState}>Wähle einen gebuchten Slot aus, um die Details zu sehen.</p>
            ) : (
              <div className={styles.detailStack}>
                <div className={styles.detailRow}>
                  <span>Datum</span>
                  <strong>{dateTimeFmt.format(new Date(selectedBooking.starts_at))}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>Kundenname</span>
                  <strong>{selectedBooking.customer_name || "-"}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>E-Mail</span>
                  <strong>{selectedBooking.customer_email || "-"}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>Telefon</span>
                  <strong>{selectedBooking.customer_phone || "-"}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>Hundename</span>
                  <strong>{selectedBooking.pet_name || "-"}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>Rasse</span>
                  <strong>{selectedBookingNotes?.breed || "-"}</strong>
                </div>
                <div className={styles.detailRow}>
                  <span>Notiz</span>
                  <strong>{selectedBookingNotes?.noteText || "-"}</strong>
                </div>

                <div className={styles.actionStack}>
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => setConfirmDeleteOpen(true)}
                  >
                    Reservierung löschen
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </section>

      {confirmDeleteOpen && selectedBooking ? (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <h2>Reservierung wirklich löschen?</h2>
            <p>
              Diese Buchung wird endgültig entfernt und der Slot ist danach wieder frei
              buchbar. Dieser Schritt ist nicht rückgängig machbar.
            </p>
            <div className={styles.detailRow}>
              <span>Termin</span>
              <strong>{dateTimeFmt.format(new Date(selectedBooking.starts_at))}</strong>
            </div>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => setConfirmDeleteOpen(false)}
                disabled={deleting}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => void deleteSelectedBooking()}
                disabled={deleting}
              >
                {deleting ? "Lösche..." : "Ja, löschen"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
