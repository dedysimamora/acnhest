import { z } from "zod";
import { withTransaction } from "@/lib/db";
import { handle, HttpError, requireAdmin } from "@/lib/http";

// DELETE /api/persons/:id — hanya admin. Anak-anaknya tetap ada (menjadi tanpa orang tua
// jika union orang tuanya ikut terhapus).
export const DELETE = handle(async (_request: Request, ctx: RouteContext<"/api/persons/[id]">) => {
  await requireAdmin();
  const id = z.coerce.number().int().positive().parse((await ctx.params).id);
  await withTransaction(async (db) => {
    // Union dengan dua pasangan: jangan hapus union-nya, cukup lepaskan orang ini,
    // agar anak tetap terhubung ke orang tua yang lain.
    await db.query(
      "UPDATE unions SET partner_a = partner_b, partner_b = NULL WHERE partner_a = $1 AND partner_b IS NOT NULL",
      [id],
    );
    await db.query("UPDATE unions SET partner_b = NULL WHERE partner_b = $1", [id]);
    const res = await db.query("DELETE FROM persons WHERE id = $1", [id]);
    if (res.rowCount === 0) throw new HttpError(404, "Data tidak ditemukan");
  });
  return Response.json({ ok: true });
});
