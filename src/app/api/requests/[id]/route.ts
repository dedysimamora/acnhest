import { z } from "zod";
import { handle, readJson, requireAdmin } from "@/lib/http";
import { reviewRequest } from "@/lib/requests";

const reviewInput = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => v || null),
});

// PATCH /api/requests/:id  { decision: "approve" | "reject", note? }
export const PATCH = handle(async (request: Request, ctx: RouteContext<"/api/requests/[id]">) => {
  const admin = await requireAdmin();
  const id = z.coerce.number().int().positive().parse((await ctx.params).id);
  const { decision, note } = reviewInput.parse(await readJson(request));
  await reviewRequest(admin, id, decision, note);
  return Response.json({ ok: true });
});
