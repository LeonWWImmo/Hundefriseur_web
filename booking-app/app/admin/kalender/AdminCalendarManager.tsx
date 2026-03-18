"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type BookingBlock = {
  id: string;
  starts_at: string;
  ends_at: string;
  label: string | null;
  notes: string | null;
  created_at?: string;
};

type Service = {
  id: string;
  name: string;
};

type Slot = {
  slot_start: string;
  slot_end: string;
};

type SelectedSlot = {
  slot_start: string;
  slot_end: string;
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

function normalizeServiceName(value: string) {
  return value
    .toLocaleLowerCase("de-CH")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " und ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function todayIso() {
  return ymdFmt.format(new Date());
}

function toIsoDate(date: Date) {
  return ymdFmt.format(date);
}

function startOfWeekMonday(isoDay: string) {
  const d = new Date(`${isoDay}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function buildWeek(weekStartIso: string): DayItem[] {
  const monday = startOfWeekMonday(weekStartIso);
  return [0, 1, 2, 3, 4, 5].map((offset) => {
    const d = addDays(monday, offset);
    return {
      iso: toIsoDate(d),
      label: weekdayFmt.format(d),
      dateLabel: dateFmt.format(d),
    };
  });
}

function currentWeekMondayIso() {
  return toIsoDate(startOfWeekMonday(todayIso()));
}

function formatBlockLabel(block: BookingBlock) {
  const start = new Date(block.starts_at);
  const end = new Date(block.ends_at);
  const startText = dateTimeFmt.format(start);
  const endText = dateTimeFmt.format(end);
  const startDate = dateFmt.format(start);
  const endDate = dateFmt.format(end);
  const startTime = timeFmt.format(start);
  const endTime = timeFmt.format(end);

  if (
    startTime === "00:00" &&
    endTime === "00:00" &&
    end.getTime() - start.getTime() >= 24 * 60 * 60 * 1000
  ) {
    return `${startDate} - ${dateFmt.format(addDays(end, -1))} | Ganzer Tag`;
  }

  if (startDate === endDate) {
    return `${startDate} ${startTime} - ${endTime}`;
  }

  return `${startText} - ${endText}`;
}

export default function AdminCalendarManager() {
  const [serviceId, setServiceId] = useState("");
  const [weekStartIso, setWeekStartIso] = useState(() => currentWeekMondayIso());
  const [slotsByDay, setSlotsByDay] = useState<Record<string, Slot[]>>({});
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<Record<string, SelectedSlot>>({});
  const [blocks, setBlocks] = useState<BookingBlock[]>([]);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [loadingBlocks, setLoadingBlocks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [label, setLabel] = useState("Ferien");
  const [notes, setNotes] = useState("");

  const weekDays = useMemo(() => buildWeek(weekStartIso), [weekStartIso]);
  const selectedDaySet = new Set(selectedDays);
  const selectedSlotSet = new Set(Object.keys(selectedSlots));

  useEffect(() => {
    async function loadServices() {
      const response = await fetch("/api/services");
      const payload = (await response.json().catch(() => ({}))) as {
        services?: Service[];
        error?: string;
        details?: string;
      };

      if (!response.ok) {
        const message = payload.details ? `${payload.error}: ${payload.details}` : payload.error;
        setError(message || "Services konnten nicht geladen werden.");
        return;
      }

      const nextServices = payload.services ?? [];
      if (!serviceId && nextServices.length > 0) {
        const preferredService =
          nextServices.find((service) => normalizeServiceName(service.name) === "ganzer service") ??
          nextServices[0];
        setServiceId(preferredService.id);
      }
    }

    void loadServices();
  }, [serviceId]);

  useEffect(() => {
    async function loadWeekSlots() {
      if (!serviceId || weekDays.length === 0) return;

      setLoadingWeek(true);
      setError("");
      setSuccess("");

      const responses = await Promise.all(
        weekDays.map(async (day) => {
          const params = new URLSearchParams({ serviceId, day: day.iso });
          const response = await fetch(`/api/slots?${params.toString()}`);
          const payload = await response.json();
          return { day: day.iso, ok: response.ok, payload };
        }),
      );

      const next: Record<string, Slot[]> = {};
      for (const item of responses) {
        if (!item.ok) {
          const message = item.payload.details
            ? `${item.payload.error}: ${item.payload.details}`
            : item.payload.error;
          setError(message || "Slots konnten nicht geladen werden.");
          setSlotsByDay({});
          setLoadingWeek(false);
          return;
        }

        next[item.day] = ((item.payload.slots || []) as Slot[]).sort(
          (a, b) => new Date(a.slot_start).getTime() - new Date(b.slot_start).getTime(),
        );
      }

      setSlotsByDay(next);
      setLoadingWeek(false);
    }

    void loadWeekSlots();
  }, [serviceId, weekDays]);

  useEffect(() => {
    async function loadBlocks() {
      setLoadingBlocks(true);
      const params = new URLSearchParams({ upcomingOnly: "true" });
      const response = await fetch(`/api/admin/blocks?${params.toString()}`);
      const payload = (await response.json().catch(() => ({}))) as {
        blocks?: BookingBlock[];
        error?: string;
        details?: string;
      };

      if (!response.ok) {
        const message = payload.details ? `${payload.error}: ${payload.details}` : payload.error;
        setError(message || "Blocks konnten nicht geladen werden.");
        setBlocks([]);
        setLoadingBlocks(false);
        return;
      }

      setBlocks(payload.blocks ?? []);
      setLoadingBlocks(false);
    }

    void loadBlocks();
  }, []);

  function shiftWeek(direction: -1 | 1) {
    const monday = startOfWeekMonday(weekStartIso);
    const shifted = addDays(monday, direction * 7);
    setWeekStartIso(toIsoDate(shifted));
  }

  function jumpToCurrentWeek() {
    setWeekStartIso(currentWeekMondayIso());
  }

  function toggleDay(dateKey: string) {
    const daySlots = slotsByDay[dateKey] || [];
    if (daySlots.length === 0) return;

    setSelectedDays((current) =>
      current.includes(dateKey)
        ? current.filter((value) => value !== dateKey)
        : [...current, dateKey].sort(),
    );
  }

  function toggleSlot(slotStart: string) {
    let matchingSlot: Slot | null = null;
    for (const daySlots of Object.values(slotsByDay)) {
      const found = daySlots.find((slot) => slot.slot_start === slotStart);
      if (found) {
        matchingSlot = found;
        break;
      }
    }
    if (!matchingSlot) return;

    setSelectedSlots((current) => {
      if (current[slotStart]) {
        const next = { ...current };
        delete next[slotStart];
        return next;
      }
      return {
        ...current,
        [slotStart]: {
          slot_start: matchingSlot.slot_start,
          slot_end: matchingSlot.slot_end,
        },
      };
    });
  }

  function clearSelection() {
    setSelectedDays([]);
    setSelectedSlots({});
  }

  async function createBlocksFromRanges(ranges: Array<{ startsAt: string; endsAt: string }>, successText: string) {
    if (ranges.length === 0) {
      setError("Bitte zuerst Tage oder Slots auswählen.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const response = await fetch("/api/admin/blocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ranges, label, notes }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      blocks?: BookingBlock[];
      error?: string;
      details?: string;
    };

    if (!response.ok) {
      const message = payload.details ? `${payload.error}: ${payload.details}` : payload.error;
      setError(message || "Blocks konnten nicht gespeichert werden.");
      setSaving(false);
      return;
    }

    setBlocks((current) =>
      [...current, ...(payload.blocks ?? [])].sort(
        (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
      ),
    );
    clearSelection();
    setSuccess(successText);
    setSaving(false);
  }

  async function blockSelection() {
    const combinedSlots = new Map<string, SelectedSlot>(Object.entries(selectedSlots));
    for (const dateKey of selectedDays) {
      for (const slot of slotsByDay[dateKey] || []) {
        combinedSlots.set(slot.slot_start, {
          slot_start: slot.slot_start,
          slot_end: slot.slot_end,
        });
      }
    }

    const ranges = Array.from(combinedSlots.values()).map((slot) => ({
      startsAt: slot.slot_start,
      endsAt: slot.slot_end,
    }));

    await createBlocksFromRanges(ranges, `${ranges.length} Slot(s) gesperrt.`);
  }

  async function deleteBlock(id: string) {
    setDeletingId(id);
    setError("");
    setSuccess("");

    const response = await fetch(`/api/admin/blocks/${id}`, { method: "DELETE" });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      details?: string;
    };

    if (!response.ok) {
      const message = payload.details ? `${payload.error}: ${payload.details}` : payload.error;
      setError(message || "Block konnte nicht gelöscht werden.");
      setDeletingId("");
      return;
    }

    setBlocks((current) => current.filter((block) => block.id !== id));
    setSuccess("Sperrung gelöscht.");
    setDeletingId("");
  }

  return (
    <div className={styles.manager}>
      <section className={styles.controlsCard}>
        <div className={styles.toolbar}>
          <div>
            <p className={styles.kicker}>Admin Bereich</p>
            <h1>Kalender</h1>
          </div>

          <div className={styles.toolbarActions}>
            <form action="/api/admin/logout" method="post">
              <button type="submit" className={styles.logoutBtn}>
                Logout
              </button>
            </form>
          </div>
        </div>

        <div className={styles.setupGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2>Verfügbarkeit</h2>
              {loadingWeek ? <p>Slots werden geladen...</p> : null}
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
                const daySlots = slotsByDay[day.iso] || [];
                const daySelected = selectedDaySet.has(day.iso);
                return (
                  <div
                    key={day.iso}
                    className={`${styles.dayCell} ${daySelected ? styles.dayCellSelected : ""} ${
                      daySlots.length === 0 ? styles.dayCellUnavailable : ""
                    }`.trim()}
                  >
                    <button
                      type="button"
                      className={styles.dayToggle}
                      onClick={() => toggleDay(day.iso)}
                      disabled={daySlots.length === 0}
                    >
                      <small className={styles.dayDateInline}>
                        {day.label} {day.dateLabel}
                      </small>
                    </button>

                    <div className={styles.slotPills}>
                      {daySlots.length === 0 ? (
                        <div className={styles.slotEmpty}>Keine Slots</div>
                      ) : null}
                      {daySlots.map((slot) => {
                        const selected = selectedSlotSet.has(slot.slot_start);
                        return (
                          <button
                            key={slot.slot_start}
                            type="button"
                            className={`${styles.slotPill} ${selected ? styles.slotPillSelected : ""}`.trim()}
                            onClick={() => toggleSlot(slot.slot_start)}
                          >
                            {timeFmt.format(new Date(slot.slot_start))}
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
              <h2>Sperrung anlegen</h2>
              <p>Tage oder einzelne Slots auswählen</p>
            </div>

            <div className={styles.selectionSummary}>
              <div className={styles.summaryBox}>
                <strong>{selectedDays.length}</strong>
                <span>Tage markiert</span>
              </div>
              <div className={styles.summaryBox}>
                <strong>{Object.keys(selectedSlots).length}</strong>
                <span>Slots markiert</span>
              </div>
            </div>

            <label>
              Titel
              <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Ferien" />
            </label>

            <label>
              Notiz
              <textarea
                rows={4}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optionaler Hinweis für dich"
              />
            </label>

            <div className={styles.actionStack}>
              <button type="button" className={styles.primaryBtn} onClick={() => void blockSelection()} disabled={saving}>
                {saving ? "Speichere..." : "Auswahl sperren"}
              </button>
            </div>
          </section>
        </div>
      </section>

      <section className={styles.listCard}>
        <div className={styles.panelHead}>
          <h2>Vorhandene Sperrungen</h2>
          <p>{loadingBlocks ? "Lade..." : `${blocks.length} zukünftige Einträge`}</p>
        </div>

        {blocks.length === 0 && !loadingBlocks ? (
          <p className={styles.emptyState}>Es gibt aktuell keine zukünftigen Sperrungen.</p>
        ) : null}

        <div className={styles.blockList}>
          {blocks.map((block) => (
            <article key={block.id} className={styles.blockItem}>
              <div>
                <strong>{block.label || "Sperrung"}</strong>
                <p>{formatBlockLabel(block)}</p>
                {block.notes ? <small>{block.notes}</small> : null}
              </div>

              <button
                type="button"
                className={styles.deleteBtn}
                onClick={() => void deleteBlock(block.id)}
                disabled={deletingId === block.id}
              >
                {deletingId === block.id ? "Lösche..." : "Löschen"}
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
