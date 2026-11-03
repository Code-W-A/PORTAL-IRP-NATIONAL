import { guideRequest, readBody } from "@/lib/server/ghid-comunicare/http";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(req: Request, context: Context) {
  const { id } = await context.params;
  return guideRequest(req, service => service.get(id));
}
export async function PATCH(req: Request, context: Context) {
  const { id } = await context.params;
  return guideRequest(req, async (service, actor) => service.update(id, actor, await readBody(req)));
}
export async function DELETE(req: Request, context: Context) {
  const { id } = await context.params;
  return guideRequest(req, (service, actor) => service.withdraw(id, actor));
}
