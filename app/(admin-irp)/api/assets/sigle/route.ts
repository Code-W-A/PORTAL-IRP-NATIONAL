import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function GET() {
  try {
    const dir = path.join(process.cwd(), "public", "sigle");
    const entries = await fs.readdir(dir).catch(() => [] as string[]);
    const files = entries.filter((f) => /(\.png|\.jpg|\.jpeg|\.svg)$/i.test(f)).map((f) => `/sigle/${f}`);
    return NextResponse.json({ files });
  } catch (e) {
    return NextResponse.json({ files: [] }, { status: 200 });
  }
}


