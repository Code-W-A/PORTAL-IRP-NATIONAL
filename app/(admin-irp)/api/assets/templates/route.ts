import { NextResponse } from "next/server";
import { readdirSync } from "fs";
import { join } from "path";

export async function GET() {
  try {
    const dir = join(process.cwd(), "public", "templates", "pdf");
    const files = readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".pdf"))
      .map((d) => ({ key: d.name, url: `/templates/pdf/${encodeURIComponent(d.name)}` }));
    return NextResponse.json(files);
  } catch {
    return NextResponse.json([]);
  }
}




