import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import Image from "next/image";
// import FlyerWidget from "./components/FlyerWidget";

export const metadata: Metadata = {
  title: "Hundecoiffeur Pepita in Horgen | Hundefriseur",
  description:
    "Hundecoiffeur in Horgen: professioneller Hundefriseur für Schneiden, Waschen, Föhnen und Pflege. Termine bei Hundecoiffeur Pepita einfach online buchen.",
  keywords: [
    "hundecoiffeur",
    "hundecoiffeur horgen",
    "hundefriseur",
    "hundefriseur horgen",
    "hundesalon horgen",
    "hundepflege horgen",
    "hunde friseur",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Hundecoiffeur Pepita in Horgen | Hundefriseur",
    description:
      "Hundecoiffeur in Horgen für liebevolle und professionelle Hundepflege inklusive Schneiden, Waschen und Föhnen.",
    url: "/",
    type: "website",
    locale: "de_CH",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const localBusinessJsonLd = {
  "@context": "https://schema.org",
  "@type": "PetGrooming",
  name: "Hundecoiffeur Pepita",
  image: ["/Pictures/logo-no-backgorund.png", "/Pictures/Webpicture.jpg"],
  telephone: "+41 76 774 08 22",
  email: "coiffeur.pepita@gmail.com",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Zugerstrasse 90",
    postalCode: "8810",
    addressLocality: "Horgen",
    addressCountry: "CH",
  },
  areaServed: "Horgen",
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "09:00",
      closes: "16:00",
    },
  ],
  sameAs: ["https://www.instagram.com/hundecoiffeurpepita"],
  url: "/",
};

export default function HomePage() {
  return (
    <>
      <Script id="local-business-jsonld" type="application/ld+json">
        {JSON.stringify(localBusinessJsonLd)}
      </Script>

      <header className="site-header">
        <div className="container header-inner">
          <Link href="/" className="brand">
            <span className="brand-text">Hundecoiffeur&nbsp;Pepita</span>
          </Link>

          <Link href="/" className="center-logo" aria-label="Startseite Hundecoiffeur Pepita">
            <div className="logo-wrapper">
              <Image
                src="/Pictures/logo-no-backgorund.png"
                alt="Logo vom Hundecoiffeur Pepita in Horgen"
                width={120}
                height={120}
              />
            </div>
          </Link>

          <input id="nav-toggle" className="nav-toggle" type="checkbox" aria-label="Menü anzeigen" />
          <label htmlFor="nav-toggle" className="burger" aria-label="Menü öffnen">
            &#9776;
          </label>

          <nav className="nav" aria-label="Hauptnavigation">
            <a href="#dienstleistungen">Dienstleistungen</a>
            <a href="#kontakt">Kontakt</a>
            <Link className="btn primary" href="/sizes">
              Buchung
            </Link>
          </nav>
        </div>
      </header>
      {/* <FlyerWidget /> */}

      <main>
        <section className="hero hero-double">
          <div className="hero-images">
            <Image
              src="/Pictures/Webpicture (2).jpg"
              alt="Hundefriseur schneidet Hund im Salon"
              className="hero-img"
              width={1200}
              height={900}
              priority
            />
            <Image
              src="/Pictures/Webpicture.jpg"
              alt="Hundecoiffeur Behandlung im Hundesalon Horgen"
              className="hero-img"
              width={1200}
              height={900}
              priority
            />
          </div>

          <div className="container hero-inner">
            <h1>Hundecoiffeur in Horgen für entspannte und gepflegte Hunde</h1>
            <p>
              Sanfte Pflege, modernes Equipment und viel Herz - für einen entspannten
              Coiffeur-Termin.
            </p>
            <div className="cta">
              <a className="btn ghost" href="#dienstleistungen">
                Leistungen ansehen
              </a>
              <Link className="btn primary" href="/sizes">
                Termin buchen
              </Link>
            </div>
          </div>
        </section>

        <section id="dienstleistungen" className="section">
          <div className="container">
            <h2>Dienstleistungen beim Hundefriseur</h2>
            <p className="section-intro">Preise variieren je nach Fellzustand und Größe.</p>

            <div className="grid cards">
              <article className="card">
                <h3>Basis-Service</h3>
                <ul>
                  <li>Schneiden</li>
                  <li>Waschen und Föhnen</li>
                  <li>Kämmen</li>
                  <li>Trimmen</li>
                </ul>
                <div className="price">80 CHF / Std.</div>
                <div className="actions">
                  <Link className="btn" href="/sizes?service=Basis-Service">
                    Größe wählen
                  </Link>
                </div>
              </article>

              <article className="card">
                <h3>Waschen und Föhnen</h3>
                <ul>
                  <li>
                    Waschen und Föhnen <br />
                    Preis von Hundegröße abhängig
                  </li>
                </ul>
                <div className="price">ab 60 CHF / Std.</div>
                <div className="actions">
                  <Link className="btn" href="/sizes?service=Waschen%20%26%20F%C3%B6hnen">
                    Größe wählen
                  </Link>
                </div>
              </article>

              <article className="card">
                <h3>Zusatzleistung</h3>
                <ul>
                  <li>Krallen schneiden</li>
                  <li>Pfotenpflege</li>
                  <li>Ohrenpflege</li>
                  <li>Filz auskämmen</li>
                </ul>
                <div className="price">20 CHF / je Leistung</div>
                <div className="actions">
                  <Link className="btn" href="/sizes?service=Zusatzleistung">
                    Größe wählen
                  </Link>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="zertifikat" className="section" style={{ textAlign: "center", overflowX: "hidden" }}>
          <div className="container" style={{ padding: 0 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-start",
                alignItems: "center",
                gap: "30px",
                overflowX: "auto",
                scrollSnapType: "x mandatory",
                WebkitOverflowScrolling: "touch",
                padding: "20px 40px",
              }}
            >
              {[
                "/Pictures/Hundvorher.png",
                "/Pictures/Hundnachschneiden.png",
                "/Pictures/Zertifikat.png",
                "/Pictures/Hundeschneiden.png",
                "/Pictures/hundebild5.png",
                "/Pictures/Hundeschneiden6.png",
                "/Pictures/face.png",
                "/Pictures/laden.png",
                "/Pictures/Hundgeschnitte2.png",
                "/Pictures/Hundgeschnitten3.png",
                "/Pictures/Hundgeschnitten4.png",
              ].map((src) => (
                <Image
                  key={src}
                  src={src}
                  alt="Galerie vom Hundecoiffeur Pepita"
                  width={250}
                  height={250}
                  style={{
                    width: "250px",
                    height: "250px",
                    borderRadius: src.includes("Zertifikat") ? "50%" : "20px",
                    objectFit: "cover",
                    flexShrink: 0,
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    scrollSnapAlign: "center",
                  }}
                />
              ))}
            </div>
          </div>
        </section>

        <section id="kontakt" className="section alt">
          <div className="container">
            <h2>Kontakt Hundecoiffeur Pepita</h2>
            <div className="grid contact-grid">
              <div>
                <p>
                  <strong>Hundecoiffeur Pepita</strong>
                </p>
                <p>
                  <strong>Adresse</strong>
                  <br />
                  Zugerstrasse 90
                  <br />
                  8810 Horgen
                </p>
                <p>
                  <strong>Öffnungszeiten</strong>
                  <br />
                  Mo-Fr: 09:00-16:00
                </p>
                <p>
                  <strong>Telefon:</strong> <a href="tel:+41767740822">076 774 08 22</a>
                  <br />
                  <strong>E-Mail:</strong>{" "}
                  <a href="mailto:coiffeur.pepita@gmail.com">coiffeur.pepita@gmail.com</a>
                </p>

                <div className="cta">
                  <a className="btn ghost" href="https://wa.me/41767740822" target="_blank" rel="noopener">
                    WhatsApp
                  </a>
                  <a
                    className="btn"
                    href="https://www.instagram.com/hundecoiffeurpepita"
                    target="_blank"
                    rel="noopener"
                  >
                    Instagram
                  </a>
                  <Link className="btn" href="/sizes">
                    Termin buchen
                  </Link>
                </div>
              </div>

              <div className="map-wrap">
                <iframe
                  className="map"
                  title="Karte Hundecoiffeur Horgen"
                  loading="lazy"
                  src="https://www.google.com/maps?q=Zugerstrasse%2090%2C%208810%20Horgen&output=embed"
                />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="disclaimer">
          <p style={{ marginTop: "12px" }}>
            <strong>Bei Fragen melden Sie sich bei:</strong>{" "}
            <a href="mailto:coiffeur.pepita@gmail.com">coiffeur.pepita@gmail.com</a>
          </p>
          <p>Richtlinien für den Friseursalon Pepita:</p>
          <p>
            1. Haftungsausschluss bei Schäden: Im Friseursalon Pepita übernehmen wir keine
            Haftung für Schäden, die durch die Kunden oder ihre Haustiere verursacht werden.
          </p>
          <p>
            2. Verantwortung für persönliche Gegenstände: Die Verantwortung für persönliche
            Wertgegenstände und Ausrüstung liegt beim Besitzer.
          </p>
          <p>
            3. Fotoveröffentlichung: Wenn Sie nicht möchten, dass Fotos Ihres Hundes
            veröffentlicht werden, bitten wir Sie, uns dies im Voraus mitzuteilen.
          </p>
          <p>
            4. Recht auf Verweigerung des Dienstes: Wir behalten uns das Recht vor, den Salon
            bei unangemessenem Verhalten ohne Rückerstattung zu verlassen.
          </p>
          <p>
            5. Stornierung: Stornierungen, die weniger als 24 Stunden vor dem Termin erfolgen,
            können mit einer Gebühr belegt werden.
          </p>
        </div>
      </footer>
    </>
  );
}
