import { destroySession } from "@/lib/auth";
import { handle } from "@/lib/http";

export const POST = handle(async () => {
  await destroySession();
  return Response.json({ ok: true });
});
