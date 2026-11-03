import { guideRequest, readBody } from "@/lib/server/ghid-comunicare/http";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(req: Request, context: Context) {
  const { id } = await context.params;
  return guideRequest(req, service => service.completions(id, new URL(req.url).searchParams.get("cursor")));
}
export async function POST(req: Request, context: Context) {
  const { id } = await context.params;
  return guideRequest(req, async (service, actor) => service.createCompletion(id, actor, await readBody(req)));
}
