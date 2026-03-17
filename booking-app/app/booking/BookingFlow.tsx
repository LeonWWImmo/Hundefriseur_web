"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import styles from "./page.module.css";

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price_chf: number;
};

type Slot = {
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
const weekdayLongFmt = new Intl.DateTimeFormat("de-CH", {
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TZ,
});
const dateFmt = new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit", timeZone: TZ });
const timeFmt = new Intl.DateTimeFormat("de-CH", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: TZ,
});
const ymdFmt = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: TZ,
});

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

function currentWeekMondayIso() {
  return toIsoDate(startOfWeekMonday(todayIso()));
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

function slotLabel(slot: Slot) {
  return `${timeFmt.format(new Date(slot.slot_start))} - ${timeFmt.format(new Date(slot.slot_end))}`;
}

function normalizeServiceName(value: string) {
  return value
    .toLocaleLowerCase("de-CH")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " und ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getServicePriceLabel(service: Service) {
  const normalized = normalizeServiceName(service.name);

  if (normalized.includes("zusatzleistung")) {
    return `CHF ${service.price_chf} / je Leistung`;
  }

  if (normalized.includes("waschen") || normalized.includes("fohnen")) {
    return `ab CHF ${service.price_chf} / Std.`;
  }

  return `CHF ${service.price_chf} / Std.`;
}

function getServiceDisplayName(service: Service) {
  const normalized = normalizeServiceName(service.name);
  if (normalized === "ganzer service") {
    return "Basis-Service";
  }
  return service.name;
}

function dayOfWeek(isoDay: string) {
  return new Date(`${isoDay}T12:00:00`).getDay();
}

function getOrCreateCustomerSessionId() {
  if (typeof window === "undefined") return "";
  const key = "booking_customer_session_id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const next =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `sess-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(key, next);
  return next;
}

export default function NewBookingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedServiceName = (searchParams.get("service") || "").trim();

  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [weekStartIso, setWeekStartIso] = useState(() => toIsoDate(startOfWeekMonday(todayIso())));
  const [slotsByDay, setSlotsByDay] = useState<Record<string, Slot[]>>({});
  const [blockedSlotStarts, setBlockedSlotStarts] = useState<Record<string, boolean>>({});
  const [selectedSlotStart, setSelectedSlotStart] = useState("");

  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingWeek, setLoadingWeek] = useState(false);
  const [creatingHoldAt, setCreatingHoldAt] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dogName, setDogName] = useState("");
  const [dogBreed, setDogBreed] = useState("");
  const [dogSize, setDogSize] = useState("Klein");
  const [notes, setNotes] = useState("");

  const weekDays = useMemo(() => buildWeek(weekStartIso), [weekStartIso]);

  useEffect(() => {
    const rawSize = new URLSearchParams(window.location.search).get("size") || "";
    if (rawSize === "Klein" || rawSize === "Mittel" || rawSize === "Gross") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDogSize(rawSize);
    }
  }, []);

  useEffect(() => {
    async function loadServices() {
      setLoadingServices(true);
      setError("");
      const res = await fetch("/api/services");
      const payload = await res.json();

      if (!res.ok) {
        const msg = payload.details ? `${payload.error}: ${payload.details}` : payload.error;
        setError(msg || "Services konnten nicht geladen werden.");
        setLoadingServices(false);
        return;
      }

      const nextServices = (payload.services || []) as Service[];
      setServices(nextServices);
      const requestedNorm = normalizeServiceName(requestedServiceName);
      const preselectedService = requestedNorm
        ? nextServices.find((service) => normalizeServiceName(service.name) === requestedNorm)
        : undefined;
      if (preselectedService) {
        setServiceId(preselectedService.id);
      } else if (nextServices[0]) {
        setServiceId(nextServices[0].id);
      }
      setLoadingServices(false);
    }

    void loadServices();
  }, [requestedServiceName]);

  useEffect(() => {
    async function loadWeekSlots() {
      if (!serviceId || weekDays.length === 0) return;

      setLoadingWeek(true);
      setError("");
      setSuccess("");
      setSelectedSlotStart("");

      const responses = await Promise.all(
        weekDays.map(async (day) => {
          const params = new URLSearchParams({ serviceId, day: day.iso });
          const res = await fetch(`/api/slots?${params.toString()}`);
          const payload = await res.json();
          return { day: day.iso, ok: res.ok, payload };
        }),
      );

      const next: Record<string, Slot[]> = {};
      for (const item of responses) {
        if (!item.ok) {
          const msg = item.payload.details
            ? `${item.payload.error}: ${item.payload.details}`
            : item.payload.error;
          setError(msg || "Slots konnten nicht geladen werden.");
          setSlotsByDay({});
          setLoadingWeek(false);
          return;
        }
        next[item.day] = (item.payload.slots || []) as Slot[];
      }

      setSlotsByDay(next);
      setLoadingWeek(false);
    }

    void loadWeekSlots();
  }, [serviceId, weekDays]);

  function selectSlot(slotStart: string) {
    if (blockedSlotStarts[slotStart]) return;
    setError("");
    setSuccess("");
    setSelectedSlotStart(slotStart);
  }

  async function confirmBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSlotStart) {
      setError("Bitte zuerst einen Termin auswaehlen.");
      return;
    }

    const customerSessionId = getOrCreateCustomerSessionId();
    if (!customerSessionId) {
      setError("Session fehlt. Bitte Seite neu laden.");
      return;
    }

    setConfirming(true);
    setCreatingHoldAt(selectedSlotStart);
    setError("");
    setSuccess("");

    const holdRes = await fetch("/api/holds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId,
        slotStart: selectedSlotStart,
        customerSessionId,
      }),
    });
    const holdPayload = await holdRes.json();

    if (!holdRes.ok) {
      setConfirming(false);
      setCreatingHoldAt("");
      const msg = holdPayload.details
        ? `${holdPayload.error}: ${holdPayload.details}`
        : holdPayload.error;
      setError(msg || "Reservierung konnte nicht erstellt werden.");
      return;
    }

    const hold = (holdPayload.hold || {}) as Record<string, unknown>;
    const holdId = String(hold.hold_id ?? hold.id ?? "");
    if (!holdId) {
      setConfirming(false);
      setCreatingHoldAt("");
      setError("Reservierung konnte nicht gelesen werden.");
      return;
    }

    const res = await fetch("/api/bookings/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        holdId,
        customerSessionId,
        customerName: name,
        customerEmail: email,
        customerPhone: phone,
        serviceName: selectedService ? getServiceDisplayName(selectedService) : "",
        serviceDurationMinutes: selectedService?.duration_minutes || 0,
        petName: dogName,
        dogSize,
        appointmentAt: selectedSlotStart,
        dogBreed,
        notes,
      }),
    });
    const payload = await res.json();
    setConfirming(false);
    setCreatingHoldAt("");

    if (!res.ok) {
      const msg = payload.details ? `${payload.error}: ${payload.details}` : payload.error;
      setError(msg || "Buchung konnte nicht bestaetigt werden.");
      return;
    }

    setBlockedSlotStarts((prev) => ({ ...prev, [selectedSlotStart]: true }));
    setSelectedSlotStart("");
    const booking = (payload.booking || {}) as Record<string, unknown>;
    const bookingRef = String(
      booking.booking_id ?? booking.id ?? booking.reference ?? booking.confirmation_code ?? "",
    );
    router.push(bookingRef ? `/danke?booking=${encodeURIComponent(bookingRef)}` : "/danke");
  }

  function shiftWeek(direction: -1 | 1) {
    const monday = startOfWeekMonday(weekStartIso);
    const shifted = addDays(monday, direction * 7);
    setWeekStartIso(toIsoDate(shifted));
  }

  function jumpToCurrentWeek() {
    setWeekStartIso(currentWeekMondayIso());
  }

  const selectedService = services.find((service) => service.id === serviceId);

  const selectedSlotLabel = (() => {
    if (!selectedSlotStart) return "Noch kein Termin ausgewählt";
    const start = new Date(selectedSlotStart);
    const day = weekdayLongFmt.format(start);
    const time = timeFmt.format(start);
    return `${day}, ${time}`;
  })();

  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <Link href="/" className="brand">
            <span className="brand-text">Hundecoiffeur&nbsp;Pepita</span>
          </Link>
          <Link href="/" className="center-logo">
            <div className="logo-wrapper">
              <Image
                src="/Pictures/logo-no-backgorund.png"
                alt="Logo Hunde Coiffeur Pepita"
                width={120}
                height={120}
              />
            </div>
          </Link>

          <nav className="nav">
            <Link href="/#dienstleistungen">Dienstleistungen</Link>
            <Link href="/#kontakt">Kontakt</Link>
          </nav>
        </div>
      </header>

      <main className={styles.page}>
        <div className="container">
          <div className={styles.layout}>
          <div className={styles.leftCol}>
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h2>Service wählen</h2>
              </div>

              {loadingServices ? (
                <p className={styles.muted}>Services laden...</p>
              ) : (
                <div className={styles.serviceGrid}>
                  {services.map((service) => {
                    const active = service.id === serviceId;
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => setServiceId(service.id)}
                        className={`${styles.serviceTile} ${active ? styles.serviceTileActive : ""}`.trim()}
                      >
                        <span className={styles.serviceName}>{getServiceDisplayName(service)}</span>
                        <span className={styles.serviceMeta}>{getServicePriceLabel(service)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className={styles.card}>
              <div className={styles.calendarHeader}>
                <div>
                  <h2>Datum & Uhrzeit</h2>
                </div>
                <div className={styles.weekNav}>
                  <button type="button" onClick={jumpToCurrentWeek}>
                    Heute
                  </button>
                  <button type="button" onClick={() => shiftWeek(-1)}>
                    Vorherige Woche
                  </button>
                  <button type="button" onClick={() => shiftWeek(1)}>
                    Nächste Woche
                  </button>
                </div>
              </div>

              {error ? <p className={styles.error}>{error}</p> : null}
              {success ? <p className={styles.success}>{success}</p> : null}

              <div className={styles.weekGrid7}>
                {weekDays.map((day, idx) => (
                  <div key={day.iso + idx} className={styles.weekDayHead}>
                    <p>{day.label}</p>
                    <strong>{day.dateLabel}</strong>
                  </div>
                ))}
              </div>

              <div className={styles.slotColumns}>
                {weekDays.map((day) => {
                  const daySlots = [...(slotsByDay[day.iso] || [])].sort(
                    (a, b) => new Date(a.slot_start).getTime() - new Date(b.slot_start).getTime(),
                  );
                  const isSaturday = dayOfWeek(day.iso) === 6;
                  return (
                    <div key={day.iso} className={styles.slotColumn}>
                      {daySlots.length === 0 ? (
                        <div className={styles.slotEmpty}>
                          {isSaturday ? "Kein Slot verfügbar" : "Keine Slots"}
                        </div>
                      ) : null}
                      {daySlots.map((slot) => {
                        const isSelected = selectedSlotStart === slot.slot_start;
                        const isBusy = creatingHoldAt === slot.slot_start;
                        const isReserved = Boolean(blockedSlotStarts[slot.slot_start]);
                        return (
                          <button
                            key={slot.slot_start}
                            type="button"
                            disabled={isBusy || isReserved}
                            onClick={() => selectSlot(slot.slot_start)}
                            className={`${styles.slotBtn} ${isSelected ? styles.slotBtnActive : ""} ${isReserved ? styles.slotBtnReserved : ""}`.trim()}
                            title={slotLabel(slot)}
                          >
                            <span>{timeFmt.format(new Date(slot.slot_start))}</span>
                            <small>{isBusy ? "Reserviere..." : isReserved ? "Reserviert" : "Frei"}</small>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              <div className={styles.mobileDays}>
                {weekDays.map((day) => {
                  const daySlots = [...(slotsByDay[day.iso] || [])].sort(
                    (a, b) => new Date(a.slot_start).getTime() - new Date(b.slot_start).getTime(),
                  );
                  const isSaturday = dayOfWeek(day.iso) === 6;
                  return (
                    <article key={`mobile-${day.iso}`} className={styles.mobileDayCard}>
                      <header className={styles.mobileDayHead}>
                        <p>{day.label}</p>
                        <strong>{day.dateLabel}</strong>
                      </header>

                      <div className={styles.mobileDaySlots}>
                        {daySlots.length === 0 ? (
                          <div className={styles.slotEmpty}>
                            {isSaturday ? "Kein Slot verfügbar" : "Keine Slots"}
                          </div>
                        ) : null}
                        {daySlots.map((slot) => {
                          const isSelected = selectedSlotStart === slot.slot_start;
                          const isBusy = creatingHoldAt === slot.slot_start;
                          const isReserved = Boolean(blockedSlotStarts[slot.slot_start]);
                          return (
                            <button
                              key={`mobile-${slot.slot_start}`}
                              type="button"
                              disabled={isBusy || isReserved}
                              onClick={() => selectSlot(slot.slot_start)}
                              className={`${styles.slotBtn} ${isSelected ? styles.slotBtnActive : ""} ${isReserved ? styles.slotBtnReserved : ""}`.trim()}
                              title={slotLabel(slot)}
                            >
                              <span>{timeFmt.format(new Date(slot.slot_start))}</span>
                              <small>{isBusy ? "Reserviere..." : isReserved ? "Reserviert" : "Frei"}</small>
                            </button>
                          );
                        })}
                      </div>
                    </article>
                  );
                })}
              </div>

              {loadingWeek ? <p className={styles.muted}>Slots werden geladen...</p> : null}
            </section>
          </div>

          <aside className={styles.rightCol}>
            <section className={`${styles.card} ${styles.sticky}`}>
              <h3 className={styles.summaryTitle}>Booking Summary</h3>

              <div className={styles.summaryItem}>
                <p>Service</p>
                <strong>{selectedService ? getServiceDisplayName(selectedService) : "-"}</strong>
                <span>
                  {selectedService
                    ? getServicePriceLabel(selectedService)
                    : "Bitte links Service wählen"}
                </span>
              </div>

              <div className={styles.summaryItem}>
                <p>Grösse</p>
                <strong>{dogSize}</strong>
                <span>Wird in der Mail-Benachrichtigung mitgeschickt</span>
              </div>

              <div className={styles.summaryItem}>
                <p>Termin</p>
                <strong>{selectedSlotLabel}</strong>
                <span>{selectedSlotStart ? "Ausgewählt (noch nicht fix gebucht)" : "Bitte links einen Slot anklicken"}</span>
              </div>

              <form onSubmit={(event) => void confirmBooking(event)} className={styles.form}>
                <label>
                  Name
                  <input required value={name} onChange={(event) => setName(event.target.value)} />
                </label>
                <label>
                  E-Mail
                  <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                </label>
                <label>
                  Telefon
                  <input required value={phone} onChange={(event) => setPhone(event.target.value)} />
                </label>
                <label>
                  Grösse
                  <select required value={dogSize} onChange={(event) => setDogSize(event.target.value)}>
                    <option value="Klein">Klein</option>
                    <option value="Mittel">Mittel</option>
                    <option value="Gross">Gross</option>
                  </select>
                </label>
                <label>
                  Hundename (optional)
                  <input value={dogName} onChange={(event) => setDogName(event.target.value)} />
                </label>
                <label>
                  Rasse (optional)
                  <input value={dogBreed} onChange={(event) => setDogBreed(event.target.value)} />
                </label>
                <label>
                  Nachricht (optional)
                  <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
                </label>

                <button className={styles.confirmBtn} type="submit" disabled={confirming || !selectedSlotStart}>
                  {confirming ? "Bestätige..." : "Termin bestätigen"}
                </button>
              </form>
            </section>
          </aside>
          </div>
        </div>
      </main>
    </>
  );
}
