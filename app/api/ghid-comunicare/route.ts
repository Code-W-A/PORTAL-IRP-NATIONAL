import { guideRequest, readBody } from "@/lib/server/ghid-comunicare/http";
export const runtime = "nodejs";
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  return guideRequest(req, service => service.list(params.get("q") || "", params.get("cursor")));
}
export async function POST(req: Request) {
  return guideRequest(req, async (service, actor) => service.create(actor, await readBody(req)));
}
