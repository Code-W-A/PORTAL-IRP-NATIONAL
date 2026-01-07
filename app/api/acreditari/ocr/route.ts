import { NextResponse } from "next/server";

import { requireBearerToken, lookupUserFromIdToken } from "@/lib/server/auth";

export const runtime = "nodejs";

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
  const requestId =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any)?.crypto?.randomUUID?.() ||
    `ocr_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  try {
    const idToken = await requireBearerToken(req);
    const authUser = await lookupUserFromIdToken(idToken);
    if (String(authUser.email || "").toLowerCase() !== "irp.isudb@gmail.com") {
      console.error("[OCR] Forbidden user", { requestId, email: authUser.email || null });
      return NextResponse.json({ error: "Forbidden", requestId }, { status: 403 });
    }

    const apiKey = process.env.OPENAI_API_KEY || "";
    if (!apiKey) {
      console.error("[OCR] Missing OPENAI_API_KEY", { requestId });
      return NextResponse.json({ error: "Missing OPENAI_API_KEY", requestId }, { status: 500 });
    }

    const form = await req.formData();
    const files = form.getAll("images").filter((x) => x instanceof File) as File[];
    if (!files.length) return NextResponse.json({ error: "No images uploaded" }, { status: 400 });
    if (files.length > 2) return NextResponse.json({ error: "Max 2 images" }, { status: 400 });
    for (const f of files) {
      const mime = String(f.type || "");
      if (!["image/jpeg", "image/png"].includes(mime)) {
        return NextResponse.json({ error: "Invalid image type. Use JPG/PNG.", requestId }, { status: 400 });
      }
    }

    console.log("[OCR] Start", {
      requestId,
      email: authUser.email || null,
      fileCount: files.length,
      types: files.map((f) => f.type),
      sizes: files.map((f) => f.size),
    });

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
      console.error("[OCR] OpenAI request failed", { requestId, status: res.status, detail: t.slice(0, 500) });
      return NextResponse.json({ error: "OpenAI request failed", detail: t.slice(0, 500) }, { status: 500 });
    }
    const data = (await res.json()) as any;
    const content = String(data?.choices?.[0]?.message?.content || "").trim();
    const parsed = safeJsonParse(content);
    if (!parsed || typeof parsed !== "object") {
      console.error("[OCR] Invalid OCR JSON", { requestId, raw: content.slice(0, 500) });
      return NextResponse.json({ error: "Invalid OCR JSON", raw: content.slice(0, 500) }, { status: 500 });
    }

    console.log("[OCR] Success", { requestId });
    return NextResponse.json({
      ok: true,
      requestId,
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
    if (msg === "missing_auth") return NextResponse.json({ error: "Missing Authorization", requestId }, { status: 401 });
    if (msg === "invalid_token") return NextResponse.json({ error: "Invalid token", requestId }, { status: 401 });
    console.error("[OCR] Failed", { requestId, msg });
    return NextResponse.json({ error: "OCR failed", detail: msg, requestId }, { status: 500 });
  }
}


