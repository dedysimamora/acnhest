import type { NextRequest } from "next/server";
import { handle, readJson, requireUser } from "@/lib/http";
import { listRequests, submitRequest } from "@/lib/requests";
import { requestInput } from "@/lib/schemas";

// GET /api/requests?scope=mine|all&status=pending|approved|rejected
export const GET = handle(async (request: NextRequest) => {
  const user = await requireUser();
  const params = request.nextUrl.searchParams;
  const status = params.get("status") ?? undefined;
  const scope = user.role === "admin" ? (params.get("scope") ?? "all") : "mine";
  const requests = await listRequests({
    status: status && ["pending", "approved", "rejected"].includes(status) ? status : undefined,
    requestedBy: scope === "mine" ? user.id : undefined,
  });
  return Response.json({ requests });
});

export const POST = handle(async (request: Request) => {
  const user = await requireUser();
  const input = requestInput.parse(await readJson(request));
  const result = await submitRequest(user, input);
  return Response.json(result, { status: 201 });
});
