import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LoginForm from "./LoginForm";
import styles from "./page.module.css";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";

export const runtime = "nodejs";

export default async function AdminLoginPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (await verifyAdminSessionToken(sessionToken)) {
    redirect("/admin/kalender");
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.kicker}>Admin</p>
        <h1>Login</h1>
        <p className={styles.intro}>
          Zugang nur für interne Verwaltung. E-Mail und Passwort werden serverseitig geprüft.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
