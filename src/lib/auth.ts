import "server-only";
import { cookies, headers } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { query } from "./db";

export const SESSION_COOKIE = "ancestry_session";
const SESSION_DAYS = 30;

export type Role = "admin" | "user";
export type SessionUser = { id: number; username: string; name: string; role: Role };

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [
    hashToken(token),
    userId,
    expires,
  ]);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await shouldUseSecureCookie(),
    path: "/",
    expires,
  });
}

/**
 * Cookie "Secure" hanya terkirim lewat HTTPS. COOKIE_SECURE=true/false memaksa nilainya;
 * kalau tidak di-set, ikuti protokol request (header x-forwarded-proto dari reverse proxy).
 */
async function shouldUseSecureCookie() {
  const env = process.env.COOKIE_SECURE;
  if (env === "true" || env === "false") return env === "true";
  return (await headers()).get("x-forwarded-proto")?.split(",")[0].trim() === "https";
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
  store.delete(SESSION_COOKIE);
}

/** Membaca user dari cookie sesi. Mengembalikan null jika tidak login / sesi kedaluwarsa. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const { rows } = await query<{ id: string; username: string; name: string; role: Role }>(
    `SELECT u.id, u.username, u.name, u.role
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)],
  );
  const row = rows[0];
  if (!row) return null;
  return { id: Number(row.id), username: row.username, name: row.name, role: row.role };
}
