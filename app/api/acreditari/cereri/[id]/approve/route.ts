import { NextResponse } from "next/server";
import React from "react";

import { requireBearerToken, lookupUserFromIdToken } from "@/lib/server/auth";
import {
  firestoreCreateDoc,
  firestoreGetDocAsJson,
  firestorePatchDoc,
} from "@/lib/server/firestoreRest";
import { buildStructuraKey, type CerereAcreditare } from "@/lib/acreditari";
import { sendMailGmailSmtp } from "@/lib/server/smtp";
export const runtime = "nodejs";

function ddmmyyyy(d = new Date()) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function normalizeLegitId(s: string) {
  return String(s || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function safeFileName(name: string): string {
  return String(name || "acreditare")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 80);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = `acr_approve_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const logPrefix = `[acreditari][approve][${requestId}]`;
  const log = (...args: any[]) => console.log(logPrefix, ...args);
  const logErr = (...args: any[]) => console.error(logPrefix, ...args);
  try {
    const { id } = await ctx.params;
    log("start", { id });
    const idToken = await requireBearerToken(req);
    const authUser = await lookupUserFromIdToken(idToken);
    const body = await req.json().catch(() => ({} as any));
    const numarOverride = typeof body?.numar === "string" ? body.numar.trim() : "";
    const dataOverride = typeof body?.data === "string" ? body.data.trim() : "";

    // Resolve tenant from user profile
    const profile = await firestoreGetDocAsJson<{ judetId?: string; structuraId?: string }>(`users/${authUser.uid}`, idToken);
    const judetId = String(profile?.judetId || "").toUpperCase();
    const structuraId = String(profile?.structuraId || "").toUpperCase();
    if (!judetId || !structuraId) return NextResponse.json({ error: "Profil incomplet (judetId/structuraId)." }, { status: 403 });
    log("tenant", { judetId, structuraId, uid: authUser.uid, email: authUser.email || null });

    // Ensure caller is owner for that structura (Settings/owner.uid === caller uid)
    const owner = await firestoreGetDocAsJson<{ uid?: string }>(`Judete/${judetId}/Structuri/${structuraId}/Settings/owner`, idToken);
    if (owner?.uid && owner.uid !== authUser.uid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const currentKey = buildStructuraKey(judetId, structuraId);
    const cerere = await firestoreGetDocAsJson<CerereAcreditare>(`CereriAcreditare/${id}`, idToken);
    if (!cerere) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!Array.isArray((cerere as any).structuraKeys) || !(cerere as any).structuraKeys.includes(currentKey)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const nowIso = new Date().toISOString();
    const statusByStructura = { ...((cerere as any).statusByStructura || {}) };
    statusByStructura[currentKey] = {
      ...(statusByStructura[currentKey] || {}),
      status: "approved",
      decidedAt: { __timestamp: nowIso },
      decidedByUid: authUser.uid,
      decidedByEmail: authUser.email || null,
    };

    await firestorePatchDoc(`CereriAcreditare/${id}`, idToken, {
      statusByStructura,
      updatedAt: { __timestamp: nowIso },
    });
    log("cerere->approved");

    // Upsert jurnalist
    const jurnalist = (cerere as any).jurnalist || {};
    const media = (cerere as any).media || {};
    const nrLegit = String(jurnalist?.legitimatie?.numar || "");
    const jId = normalizeLegitId(nrLegit) || id;
    const jurnalistPath = `Judete/${judetId}/Structuri/${structuraId}/Jurnalisti/${jId}`;
    const jurnalistDoc = {
      nume: String(jurnalist?.numePrenume || ""),
      email: String(jurnalist?.email || ""),
      legit: nrLegit,
      redactie: String(media?.denumire || ""),
      lastAcreditareYear: new Date().getFullYear(),
      updatedAt: { __timestamp: nowIso },
      createdAt: { __timestamp: nowIso },
    };
    const existingJ = await firestoreGetDocAsJson<any>(jurnalistPath, idToken);
    if (existingJ) {
      await firestorePatchDoc(jurnalistPath, idToken, jurnalistDoc);
    } else {
      await firestoreCreateDoc(`Judete/${judetId}/Structuri/${structuraId}/Jurnalisti`, idToken, jurnalistDoc, jId);
    }

    // Create Acreditari doc (so it appears in /acreditari/lista)
    const cerereNumar = String((cerere as any)?.acreditare?.numar || "").trim();
    const cerereData = String((cerere as any)?.acreditare?.data || "").trim();
    const numar = numarOverride || cerereNumar || `ACR-${new Date().getFullYear()}-${id.slice(0, 6).toUpperCase()}`;
    const sex = String((cerere as any)?.jurnalist?.sex || "").toUpperCase();
    const acrDoc = {
      numar,
      data: dataOverride || cerereData || ddmmyyyy(new Date()),
      dataTimestamp: { __timestamp: nowIso },
      nume: String(jurnalist?.numePrenume || ""),
      sex: sex === "M" ? "M" : sex === "F" ? "F" : null,
      legit: nrLegit,
      redactie: String(media?.denumire || ""),
      email: String(jurnalist?.email || ""),
      judetId,
      structuraId,
      createdAt: { __timestamp: nowIso },
      updatedAt: { __timestamp: nowIso },
      source: { cerereId: id },
    };
    const acreditareId = await firestoreCreateDoc(`Judete/${judetId}/Structuri/${structuraId}/Acreditari`, idToken, acrDoc);
    log("acreditare_created", { acreditareId, numar: acrDoc.numar, data: acrDoc.data });

    // Email (optional)
    let emailSent = false;
    let emailAttachPdf = false;
    let emailSkipReason: "missing_recipient" | "missing_smtp" | "send_failed" | "not_attempted" | null = null;
    const to = String(jurnalist?.email || "").trim();
    if (to) {
      const gen = await firestoreGetDocAsJson<any>(`Judete/${judetId}/Structuri/${structuraId}/Settings/general`, idToken).catch(() => null);
      const replyTo = String(gen?.email || "").trim() || undefined;
      const smtpUser = process.env.SMTP_USER || "";
      const smtpPass = process.env.SMTP_PASS || "";
      if (smtpUser && smtpPass) {
        const structLabel = `${structuraId} ${judetId}`;
        const origin = new URL(req.url).origin;
        const downloadUrl = `${origin}/api/acreditari/${encodeURIComponent(acreditareId)}/pdf?variant=public`;
        emailAttachPdf = false;
        log("email_attempt", { to, replyTo: replyTo || null, smtpUser, downloadUrl });
        try {
          await sendMailGmailSmtp({
            smtpUser,
            smtpPass,
            to,
            subject: `Acreditare acceptată ${structLabel}`,
            text:
              `Acreditarea dvs pe anul ${new Date().getFullYear()} a fost acceptată la ${structLabel}.\n\n` +
              `Descarcă acreditarea (fără semnături):\n${downloadUrl}\n`,
            replyTo,
          });
          log("email_success", { to });
          emailSent = true;
          emailSkipReason = null;
        } catch (e: any) {
          logErr("email_failed", { to, message: String(e?.message || e || "error") });
          emailSent = false;
          emailSkipReason = "send_failed";
        }
      } else {
        log("email_skip_missing_smtp", { to, hasUser: !!smtpUser, hasPass: !!smtpPass });
        emailSent = false;
        emailSkipReason = "missing_smtp";
      }
    } else {
      log("email_skip_missing_recipient");
      emailSent = false;
      emailSkipReason = "missing_recipient";
    }

    if (!emailSkipReason && !emailSent) emailSkipReason = "not_attempted";
    return NextResponse.json({
      ok: true,
      acreditareId,
      requestId,
      email: {
        to: to || null,
        sent: emailSent,
        attachPdf: emailAttachPdf,
        skipReason: emailSkipReason,
      },
    });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "error";
    logErr("failed", { message: msg });
    if (msg === "missing_auth") return NextResponse.json({ error: "Missing Authorization", requestId }, { status: 401 });
    if (msg === "invalid_token") return NextResponse.json({ error: "Invalid token", requestId }, { status: 401 });
    return NextResponse.json({ error: "Approve failed", requestId }, { status: 500 });
  }
}


