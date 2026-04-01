import { redirect } from "next/navigation";

export const runtime = "nodejs";

export default function AdminIndexPage() {
  redirect("/admin/login");
}
