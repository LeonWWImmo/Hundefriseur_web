import Link from "next/link";

export default function DankePage() {
  return (
    <>
      <header className="site-header">
        <div className="container header-inner">
          <Link href="/" className="brand">
            <span className="brand-text">Hundecoiffeur&nbsp;Pepita</span>
          </Link>
        </div>
      </header>

      <main className="thankyou">
        <h1>Vielen Dank für Ihre Anfrage!</h1>
        <p>
          Wir haben Ihre Terminbuchung erhalten und melden uns so schnell wie möglich zur
          Bestätigung.
          <br />
          Ihr Vertrauen bedeutet uns viel - wir freuen uns schon 🐶✨
        </p>

        <Link className="btn primary" href="/">
          Zurück zur Startseite
        </Link>
      </main>

      <footer className="site-footer">
        <div className="disclaimer">
          <p>
            <strong>Bei Fragen melden Sie sich bei:</strong>{" "}
            <a href="mailto:coiffeur.pepita@gmail.com">coiffeur.pepita@gmail.com</a>
          </p>
        </div>
      </footer>
    </>
  );
}
