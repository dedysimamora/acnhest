import { query } from "@/lib/db";
import { handle, requireAdmin } from "@/lib/http";

export const GET = handle(async () => {
  await requireAdmin();
  const { rows } = await query(
    `SELECT u.id::int, u.username, u.name, u.role, u.created_at,
            (SELECT count(*)::int FROM change_requests cr WHERE cr.requested_by = u.id) AS request_count
       FROM users u ORDER BY u.created_at`,
  );
  return Response.json({ users: rows });
});
