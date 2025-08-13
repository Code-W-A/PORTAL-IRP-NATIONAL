import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const dir = path.join(process.cwd(), "public", "sigle");
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const allowed = new Set([".png", ".jpg", ".jpeg", ".svg", ".webp"]);
    const files = entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .filter((name) => allowed.has(path.extname(name).toLowerCase()))
      .map((name) => `/sigle/${encodeURIComponent(name)}`);
    return NextResponse.json(files);
  } catch {
    return NextResponse.json([]);
  }
}


