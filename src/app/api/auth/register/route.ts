import bcrypt from "bcryptjs";
import { createSession } from "@/lib/auth";
import { query } from "@/lib/db";
import { handle, HttpError, readJson } from "@/lib/http";
import { registerInput } from "@/lib/schemas";

export const POST = handle(async (request: Request) => {
  const { username, password, name } = registerInput.parse(await readJson(request));
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await query<{ id: number }>(
    `INSERT INTO users (username, name, password_hash, role) VALUES ($1, $2, $3, 'user')
     ON CONFLICT (username) DO NOTHING RETURNING id::int`,
    [username, name, hash],
  );
  if (!rows[0]) throw new HttpError(409, "Username sudah dipakai");
  await createSession(rows[0].id);
  return Response.json({ id: rows[0].id, username, name, role: "user" }, { status: 201 });
});
