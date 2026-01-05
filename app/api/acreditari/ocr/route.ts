import { NextResponse } from "next/server";

import { requireBearerToken, lookupUserFromIdToken } from "@/lib/server/auth";

function toDataUrl(buf: ArrayBuffer, mime: string) {
  const b64 = Buffer.from(buf).toString("base64");
  return `data:${mime};base64,${b64}`;
}

function safeJsonParse(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const idToken = await requireBearerToken(req);
    const authUser = await lookupUserFromIdToken(idToken);
    if (String(authUser.email || "").toLowerCase() !== "irp.isudb@gmail.com") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const apiKey = process.env.OPENAI_API_KEY || "";
    if (!apiKey) return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });

    const form = await req.formData();
    const files = form.getAll("images").filter((x) => x instanceof File) as File[];
    if (!files.length) return NextResponse.json({ error: "No images uploaded" }, { status: 400 });
    if (files.length > 2) return NextResponse.json({ error: "Max 2 images" }, { status: 400 });

    const parts: any[] = [
      {
        type: "text",
        text: [
          "Extrage din imaginea/imagini un set de câmpuri pentru cerere acreditare.",
          "Returnează STRICT JSON (fără text în plus).",
          "Chei permise (string sau gol):",
          "- numePrenume",
          "- nrLegitimatie",
          "- institutieDenumire",
          "- jurnalistEmail",
          "- jurnalistTelefonMobil",
          "- institutieEmail",
          "- institutieTelefonMobil",
          "Dacă nu e sigur, lasă string gol.",
        ].join("\n"),
      },
    ];

    for (const f of files) {
      const mime = f.type || "image/jpeg";
      const buf = await f.arrayBuffer();
      parts.push({ type: "image_url", image_url: { url: toDataUrl(buf, mime) } });
    }

    const payload = {
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "user",
          content: parts,
        },
      ],
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return NextResponse.json({ error: "OpenAI request failed", detail: t.slice(0, 500) }, { status: 500 });
    }
    const data = (await res.json()) as any;
    const content = String(data?.choices?.[0]?.message?.content || "").trim();
    const parsed = safeJsonParse(content);
    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json({ error: "Invalid OCR JSON", raw: content.slice(0, 500) }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      fields: {
        numePrenume: String(parsed.numePrenume || ""),
        nrLegitimatie: String(parsed.nrLegitimatie || ""),
        institutieDenumire: String(parsed.institutieDenumire || ""),
        jurnalistEmail: String(parsed.jurnalistEmail || ""),
        jurnalistTelefonMobil: String(parsed.jurnalistTelefonMobil || ""),
        institutieEmail: String(parsed.institutieEmail || ""),
        institutieTelefonMobil: String(parsed.institutieTelefonMobil || ""),
      },
    });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "error";
    if (msg === "missing_auth") return NextResponse.json({ error: "Missing Authorization" }, { status: 401 });
    if (msg === "invalid_token") return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    return NextResponse.json({ error: "OCR failed" }, { status: 500 });
  }
}


