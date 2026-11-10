import { handle, requireUser } from "@/lib/http";

export const GET = handle(async () => {
  const user = await requireUser();
  return Response.json(user);
});
