import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminCalendarManager from "./AdminCalendarManager";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";

export const runtime = "nodejs";

export default async function AdminCalendarPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  if (!(await verifyAdminSessionToken(sessionToken))) {
    redirect("/admin/login");
  }

  return <AdminCalendarManager />;
}
