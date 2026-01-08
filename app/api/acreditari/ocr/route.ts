import { NextResponse } from "next/server";

import { requireBearerToken, lookupUserFromIdToken } from "@/lib/server/auth";

export const runtime = "nodejs";

function toDataUrl(buf: ArrayBuffer, mime: string) {
  const b64 = Buffer.from(buf).toString("base64");
  return `data:${mime};base64,${b64}`;
}

function safeJsonParse(s: string): any | null {
  try {
    const raw = String(s || "").trim();
    if (!raw) return null;

    // Strip markdown code fences like ```json ... ```
    const noFences = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    try {
      return JSON.parse(noFences);
    } catch {
      // Fallback: extract first JSON object/array if the model added extra text
      const firstObj = noFences.match(/\{[\s\S]*\}/);
      if (firstObj?.[0]) return JSON.parse(firstObj[0]);
      const firstArr = noFences.match(/\[[\s\S]*\]/);
      if (firstArr?.[0]) return JSON.parse(firstArr[0]);
      return null;
    }
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
          "Chei permise (string sau gol). Pentru date folosește formatul YYYY-MM-DD:",
          "",
          "Instituție (media):",
          "- mediaType (unul din: presaScrisa | tv | radio | agentie | online | altceva)",
          "- mediaAltceva (doar dacă mediaType=altceva)",
          "- numePrenume",
          "- institutieDenumire",
          "- institutieCui",
          "- institutieAdresa",
          "- institutieEmail",
          "- institutieTelefonFix",
          "- institutieTelefonFax",
          "- institutieTelefonMobil",
          "- institutieWebsite",
          "",
          "Jurnalist:",
          "- dataNasterii (YYYY-MM-DD)",
          "- locNastere",
          "- cetatenie",
          "- tipDocIdentitate (CI | Pașaport | Permis | Altul)",
          "- serieNumarDoc",
          "- adresaOptional",
          "- nrLegitimatie",
          "- jurnalistEmail",
          "- jurnalistTelefonFix",
          "- jurnalistTelefonFax",
          "- jurnalistTelefonMobil",
          "- dataExpirareLegit (YYYY-MM-DD)",
          "- functie (unul din: redactor | reporter | fotoreporter | cameraman | tehnician | altceva)",
          "- functieAltceva (doar dacă functie=altceva)",
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
      response_format: { type: "json_object" },
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
        mediaType: String(parsed.mediaType || ""),
        mediaAltceva: String(parsed.mediaAltceva || ""),
        numePrenume: String(parsed.numePrenume || ""),
        nrLegitimatie: String(parsed.nrLegitimatie || ""),
        institutieDenumire: String(parsed.institutieDenumire || ""),
        institutieCui: String(parsed.institutieCui || ""),
        institutieAdresa: String(parsed.institutieAdresa || ""),
        jurnalistEmail: String(parsed.jurnalistEmail || ""),
        jurnalistTelefonFix: String(parsed.jurnalistTelefonFix || ""),
        jurnalistTelefonFax: String(parsed.jurnalistTelefonFax || ""),
        jurnalistTelefonMobil: String(parsed.jurnalistTelefonMobil || ""),
        institutieEmail: String(parsed.institutieEmail || ""),
        institutieTelefonFix: String(parsed.institutieTelefonFix || ""),
        institutieTelefonFax: String(parsed.institutieTelefonFax || ""),
        institutieTelefonMobil: String(parsed.institutieTelefonMobil || ""),
        institutieWebsite: String(parsed.institutieWebsite || ""),
        dataNasterii: String(parsed.dataNasterii || ""),
        locNastere: String(parsed.locNastere || ""),
        cetatenie: String(parsed.cetatenie || ""),
        tipDocIdentitate: String(parsed.tipDocIdentitate || ""),
        serieNumarDoc: String(parsed.serieNumarDoc || ""),
        adresaOptional: String(parsed.adresaOptional || ""),
        dataExpirareLegit: String(parsed.dataExpirareLegit || ""),
        functie: String(parsed.functie || ""),
        functieAltceva: String(parsed.functieAltceva || ""),
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


