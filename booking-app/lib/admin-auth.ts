const encoder = new TextEncoder();

export const ADMIN_SESSION_COOKIE = "admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function requireEnv(value: string | undefined, key: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return trimmed;
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function sign(value: string) {
  const secret = requireEnv(
    process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD,
    "ADMIN_SESSION_SECRET",
  );
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function getAdminCredentials() {
  return {
    email: requireEnv(process.env.ADMIN_EMAIL, "ADMIN_EMAIL"),
    password: requireEnv(process.env.ADMIN_PASSWORD, "ADMIN_PASSWORD"),
  };
}

export function getAdminSessionMaxAge() {
  return SESSION_TTL_SECONDS;
}

export async function createAdminSessionToken(email: string) {
  const { email: adminEmail } = getAdminCredentials();
  if (email.trim().toLowerCase() !== adminEmail.toLowerCase()) {
    return null;
  }

  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = `${adminEmail.toLowerCase()}.${expiresAt}`;
  const signature = await sign(payload);
  return `${expiresAt}.${signature}`;
}

export async function verifyAdminSessionToken(token: string | undefined) {
  if (!token) return false;

  const [expiresAtRaw, signature] = token.split(".");
  const expiresAt = Number(expiresAtRaw);

  if (!expiresAtRaw || !signature || !Number.isInteger(expiresAt)) return false;
  if (expiresAt <= Math.floor(Date.now() / 1000)) return false;

  const { email: adminEmail } = getAdminCredentials();
  const expected = await sign(`${adminEmail.toLowerCase()}.${expiresAt}`);
  return timingSafeEqual(signature, expected);
}

export type AdminRequestGuardResult =
  | { ok: true }
  | { ok: false; error: string; status: number };

export async function requireAdminSession(token: string | undefined): Promise<AdminRequestGuardResult> {
  try {
    const valid = await verifyAdminSessionToken(token);
    if (!valid) {
      return { ok: false, error: "Admin session required.", status: 401 };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: `Admin auth misconfigured: ${(error as Error).message}`,
      status: 500,
    };
  }
}
