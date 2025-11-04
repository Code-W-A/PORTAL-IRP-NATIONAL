import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const candidates = ["sigle", "SIGLE", "Sigle"]; // handle case sensitivity on Linux
    let chosenDirName: string | null = null;
    let dirPath: string | null = null;

    for (const name of candidates) {
      const candidatePath = path.join(process.cwd(), "public", name);
      if (fs.existsSync(candidatePath)) {
        chosenDirName = name;
        dirPath = candidatePath;
        break;
      }
    }

    if (!dirPath || !chosenDirName) {
      return NextResponse.json([]);
    }

    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    const allowed = new Set([".png", ".jpg", ".jpeg", ".svg", ".webp"]);
    const files = entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .filter((name) => allowed.has(path.extname(name).toLowerCase()))
      .map((name) => `/${chosenDirName}/${encodeURIComponent(name)}`);
    return NextResponse.json(files);
  } catch {
    return NextResponse.json([]);
  }
}


