import { query } from "@/lib/db";
import { handle } from "@/lib/http";

// Untuk healthcheck Docker / load balancer.
export const GET = handle(async () => {
  await query("SELECT 1");
  return Response.json({ ok: true });
});
