import { NextResponse } from "next/server";

import { sendMailGmailSmtp } from "@/lib/server/smtp";
import { requireBearerToken } from "@/lib/server/auth";
import { getStructuraSettings } from "@/lib/settings/getSettings";
import { firestoreGetDocAsJson } from "@/lib/server/firestoreRest";

export const runtime = "nodejs";

type RequestBody = {
  recipients?: unknown;
};

function parseFilenameFromContentDisposition(headerValue: string | null): string | null {
  if (!headerValue) return null;

  const utfMatch = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      const decoded = decodeURIComponent(utfMatch[1]);
      return decoded.replace(/[\r\n]/g, "").trim() || null;
    } catch {}
  }

  const basicMatch = headerValue.match(/filename="?([^";]+)"?/i);
  if (basicMatch?.[1]) {
    return basicMatch[1].replace(/[\r\n]/g, "").trim() || null;
  }

  return null;
}

function buildFallbackFilename(input: string): string {
  const raw = String(input || "document").trim();
  const safe = raw
    .replace(/[\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  return `${safe || "document"}.pdf`;
}

function normalizeRecipients(input: unknown): { valid: string[]; invalid: string[] } {
  if (!Array.isArray(input)) return { valid: [], invalid: [] };

  const valid: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (const raw of input) {
    const candidate = String(raw || "").trim().toLowerCase();
    if (!candidate) continue;
    if (!emailRegex.test(candidate)) {
      invalid.push(candidate);
      continue;
    }
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    valid.push(candidate);
  }

  return { valid, invalid };
}

function getTipDocument(docData: any): string {
  return String(docData?.nume || docData?.tip || "Document").trim() || "Document";
}

function getDocumentName(docData: any): string {
  return (
    String(
      docData?.numeAfisare ||
        docData?.titlu ||
        docData?.numarComunicat ||
        docData?.numar ||
        "Document"
    ).trim() || "Document"
  );
}

function buildSubject(docData: any): string {
  const tip = getTipDocument(docData);
  const nume = getDocumentName(docData);
  return `${tip} - ${nume}`.slice(0, 180);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = `bicp_send_public_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const logPrefix = `[comunicate][send-public-pdf][${requestId}]`;
  const log = (...args: any[]) => console.log(logPrefix, ...args);
  const logErr = (...args: any[]) => console.error(logPrefix, ...args);

  try {
    const { id } = await ctx.params;
    log("start", { id });

    const idToken = await requireBearerToken(req);
    const origin = new URL(req.url).origin;
    const { tenant, settings, structura } = await getStructuraSettings(idToken, origin);

    if (!structura?.isAdmin) {
      return NextResponse.json({ error: "Forbidden", requestId }, { status: 403 });
    }

    const { judetId, structuraId } = tenant;
    const docPath = `Judete/${judetId}/Structuri/${structuraId}/Comunicate/${id}`;
    const comunicat = await firestoreGetDocAsJson<any>(docPath, idToken);
    if (!comunicat) {
      return NextResponse.json({ error: "Document not found", requestId }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const { valid, invalid } = normalizeRecipients(body?.recipients);
    if (valid.length === 0) {
      return NextResponse.json(
        {
          error: "Lista de destinatari este goală sau invalidă.",
          requestId,
          details: invalid.length ? invalid : "Nu există adrese valide.",
        },
        { status: 400 }
      );
    }
    log("recipient_count", { valid: valid.length, invalid: invalid.length });

    const smtpUser = String(process.env.SMTP_USER || "").trim();
    const smtpPass = String(process.env.SMTP_PASS || "").trim();
    if (!smtpUser || !smtpPass) {
      return NextResponse.json(
        {
          error: "SMTP neconfigurat (SMTP_USER/SMTP_PASS).",
          requestId,
        },
        { status: 500 }
      );
    }

    const pdfUrl = `${origin}/api/comunicate/${encodeURIComponent(id)}/pdf?variant=public&judetId=${encodeURIComponent(judetId)}&structuraId=${encodeURIComponent(structuraId)}`;
    const pdfRes = await fetch(pdfUrl, { method: "GET", cache: "no-store" });
    if (!pdfRes.ok) {
      logErr("pdf_fetch_failed", { status: pdfRes.status });
      return NextResponse.json(
        {
          error: "Nu am putut genera PDF-ul public pentru atașare.",
          requestId,
          details: `pdf_status_${pdfRes.status}`,
        },
        { status: 500 }
      );
    }

    const pdfArrayBuffer = await pdfRes.arrayBuffer();
    const pdfBuffer = Buffer.from(pdfArrayBuffer);
    if (!pdfBuffer.length) {
      logErr("pdf_empty");
      return NextResponse.json(
        {
          error: "PDF-ul generat este gol.",
          requestId,
        },
        { status: 500 }
      );
    }

    const filenameFromHeader = parseFilenameFromContentDisposition(pdfRes.headers.get("content-disposition"));
    const fallbackLabel = [
      String(comunicat?.nume || comunicat?.tip || "document"),
      String(comunicat?.numarComunicat ?? comunicat?.numar ?? ""),
      String(comunicat?.titlu || ""),
    ]
      .filter(Boolean)
      .join("-");
    const filename = (filenameFromHeader && filenameFromHeader.toLowerCase().endsWith(".pdf")
      ? filenameFromHeader
      : buildFallbackFilename(fallbackLabel)).slice(0, 160);

    const subject = buildSubject(comunicat);
    const tip = getTipDocument(comunicat);
    const nume = getDocumentName(comunicat);
    const structureLabel =
      String(settings?.structureDisplay || "").trim() || `${tenant.structuraId} ${tenant.judetId}`;
    const replyTo = String(settings?.email || "").trim() || undefined;

    const to = valid[0];
    const bcc = valid.slice(1);

    log("pdf_ready", { bytes: pdfBuffer.length, filename });
    log("email_attempt", { recipientsCount: valid.length, to, bccCount: bcc.length, subject });

    await sendMailGmailSmtp({
      smtpUser,
      smtpPass,
      to,
      bcc,
      toHeader: "Destinatari",
      subject,
      text:
        `Bună ziua,\n\n` +
        `Atasat regasiti ${tip} ${nume}\n\n` +
        `Dacă nu mai doriți să primiți comunicatele noastre în viitor, vă rugăm să ne transmiteți acest lucru răspunzând la acest email.\n\n` +
        `Cu stimă,\n` +
        `Compartiment Informare Relații Publice - ${structureLabel}`,
      replyTo,
      attachments: [
        {
          filename,
          contentType: "application/pdf",
          content: pdfBuffer,
        },
      ],
    });

    log("email_success", { recipientsCount: valid.length });

    return NextResponse.json({
      ok: true,
      requestId,
      email: {
        mode: "bcc",
        recipientsCount: valid.length,
        subject,
        filename,
      },
    });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "error";
    logErr("email_failed", { message: msg });

    if (msg === "missing_auth") {
      return NextResponse.json({ error: "Missing Authorization", requestId }, { status: 401 });
    }
    if (msg === "invalid_token") {
      return NextResponse.json({ error: "Invalid token", requestId }, { status: 401 });
    }
    if (msg === "missing_tenant") {
      return NextResponse.json({ error: "Profil incomplet (judetId/structuraId).", requestId }, { status: 403 });
    }

    return NextResponse.json(
      {
        error: "Trimiterea emailului a eșuat.",
        requestId,
        details: msg,
      },
      { status: 500 }
    );
  }
}
