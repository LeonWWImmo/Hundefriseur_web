"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };

    if (!response.ok) {
      setError(payload.error || "Login fehlgeschlagen.");
      setSubmitting(false);
      return;
    }

    router.push("/admin/kalender");
    router.refresh();
  }

  return (
    <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
      <label>
        E-Mail
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>

      <label>
        Passwort
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>

      {error ? <p className={styles.error}>{error}</p> : null}

      <button className="btn primary" type="submit" disabled={submitting}>
        {submitting ? "Prüfe..." : "Einloggen"}
      </button>
    </form>
  );
}
