import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });
  // For development, just print to server console. In production, forward to a log sink.
  console.log("[client-log]", body);
  return NextResponse.json({ ok: true });
}


