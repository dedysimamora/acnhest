import "server-only";
import { connection } from "next/server";
import { ZodError } from "zod";
import { getSessionUser, type SessionUser } from "./auth";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Silakan login terlebih dahulu");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new HttpError(403, "Hanya admin yang boleh melakukan ini");
  return user;
}

/** Membungkus route handler agar error diubah menjadi respons JSON yang rapi. */
export function handle<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    // Semua endpoint bergantung pada sesi/DB → selalu dijalankan saat ada request, tidak di-prerender.
    await connection();
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) {
        return Response.json({ error: err.message }, { status: err.status });
      }
      if (err instanceof ZodError) {
        const first = err.issues[0];
        return Response.json(
          { error: first?.message ?? "Data tidak valid", issues: err.issues },
          { status: 400 },
        );
      }
      console.error(err);
      return Response.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
    }
  };
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Body harus berupa JSON");
  }
}
