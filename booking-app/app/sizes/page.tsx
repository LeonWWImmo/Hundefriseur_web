"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";

const PRICES: Record<string, Record<string, number>> = {
  "Basis-Service": { Klein: 80, Mittel: 80, Gross: 80 },
  "Waschen & Föhnen": { Klein: 60, Mittel: 60, Gross: 60 },
  Zusatzleistung: { Klein: 20, Mittel: 20, Gross: 20 },
};

function normalizeServiceName(value: string) {
  if (value === "Ganzer-Service") return "Basis-Service";
  return value;
}

function SizesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselected = normalizeServiceName(
    decodeURIComponent(searchParams.get("service") || "Basis-Service"),
  );
  const [service, setService] = useState(preselected);

  const currentService = useMemo(
    () => `Aktuell gewählter Service: ${service}`,
    [service],
  );

  function go(size: "Klein" | "Mittel" | "Gross") {
    const price = PRICES[service][size];
    const unit = service === "Zusatzleistung" ? "/ Je" : "/ Std.";
    const params = new URLSearchParams({
      service,
      size,
      price: String(price),
      unit,
    });
    router.push(`/booking?${params.toString()}`);
  }

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

      <main className="section">
        <div className="container">
          <h1>Größe wählen</h1>
          <p className="section-intro">Wähle Service und Hundegröße.</p>

          <div id="currentService" style={{ fontWeight: 600, marginBottom: "10px" }}>
            {currentService}
          </div>

          <label>
            Service
            <select value={service} onChange={(event) => setService(event.target.value)}>
              <option value="Basis-Service">Basis-Service</option>
              <option value="Waschen & Föhnen">Waschen &amp; Föhnen</option>
              <option value="Zusatzleistung">Zusatzleistung</option>
            </select>
          </label>

          <div className="grid cards" style={{ marginTop: "16px" }}>
            <article className="card">
              <h3>Klein</h3>
              <p>&le; 10 kg / &lt; 35 cm</p>
              <div className="actions">
                <button className="btn primary" onClick={() => go("Klein")}>
                  Weiter
                </button>
              </div>
            </article>

            <article className="card">
              <h3>Mittel</h3>
              <p>10 - 25 kg / 35 - 55 cm</p>
              <div className="actions">
                <button className="btn primary" onClick={() => go("Mittel")}>
                  Weiter
                </button>
              </div>
            </article>

            <article className="card">
              <h3>Gross</h3>
              <p>&gt; 25 kg / &gt; 55 cm</p>
              <div className="actions">
                <button className="btn primary" onClick={() => go("Gross")}>
                  Weiter
                </button>
              </div>
            </article>
          </div>
        </div>
      </main>
    </>
  );
}

export default function SizesPage() {
  return (
    <Suspense fallback={<main className="section"><div className="container">Lade Services...</div></main>}>
      <SizesContent />
    </Suspense>
  );
}
