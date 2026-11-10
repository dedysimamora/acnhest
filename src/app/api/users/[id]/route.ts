import { z } from "zod";
import { query } from "@/lib/db";
import { handle, HttpError, readJson, requireAdmin } from "@/lib/http";

// PATCH /api/users/:id  { role: "admin" | "user" }
export const PATCH = handle(async (request: Request, ctx: RouteContext<"/api/users/[id]">) => {
  const admin = await requireAdmin();
  const id = z.coerce.number().int().positive().parse((await ctx.params).id);
  const { role } = z.object({ role: z.enum(["admin", "user"]) }).parse(await readJson(request));
  if (id === admin.id && role !== "admin") throw new HttpError(400, "Tidak bisa menurunkan role diri sendiri");
  const res = await query("UPDATE users SET role = $2 WHERE id = $1", [id, role]);
  if (res.rowCount === 0) throw new HttpError(404, "User tidak ditemukan");
  return Response.json({ ok: true });
});
