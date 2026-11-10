import bcrypt from "bcryptjs";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { handle, HttpError, readJson } from "@/lib/http";

const loginInput = z.object({
  username: z.string().trim().toLowerCase().min(1, "Username wajib diisi"),
  password: z.string().min(1, "Password wajib diisi"),
});

export const POST = handle(async (request: Request) => {
  const { username, password } = loginInput.parse(await readJson(request));
  const { rows } = await query<{ id: number; password_hash: string; name: string; role: string }>(
    "SELECT id::int, password_hash, name, role FROM users WHERE username = $1",
    [username],
  );
  const user = rows[0];
  // Selalu jalankan bcrypt agar waktu respons tidak membocorkan apakah username ada.
  const ok = await bcrypt.compare(password, user?.password_hash ?? "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
  if (!user || !ok) throw new HttpError(401, "Username atau password salah");
  await createSession(user.id);
  return Response.json({ id: user.id, username, name: user.name, role: user.role });
});
