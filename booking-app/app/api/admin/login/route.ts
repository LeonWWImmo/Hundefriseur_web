import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  getAdminCredentials,
  getAdminSessionMaxAge,
} from "@/lib/admin-auth";

export const runtime = "nodejs";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as LoginBody;
    const email = payload.email?.trim() ?? "";
    const password = payload.password?.trim() ?? "";
    const admin = getAdminCredentials();

    if (email.toLowerCase() !== admin.email.toLowerCase() || password !== admin.password) {
      return NextResponse.json({ error: "Ungültige Anmeldedaten." }, { status: 401 });
    }

    const sessionToken = await createAdminSessionToken(email);
    if (!sessionToken) {
      return NextResponse.json(
        { error: "Session konnte nicht erstellt werden." },
        { status: 500 },
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: sessionToken,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: getAdminSessionMaxAge(),
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Server configuration error", details: (error as Error).message },
      { status: 500 },
    );
  }
}
