import { guideRequest, readBody } from "@/lib/server/ghid-comunicare/http";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; completionId: string }> };
export async function PATCH(req: Request, context: Context) {
  const { id, completionId } = await context.params;
  return guideRequest(req, async (service, actor) => service.changeCompletion(id, completionId, actor, await readBody(req)));
}
export async function DELETE(req: Request, context: Context) {
  const { id, completionId } = await context.params;
  return guideRequest(req, (service, actor) => service.changeCompletion(id, completionId, actor));
}
