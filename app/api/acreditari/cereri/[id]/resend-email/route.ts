import { NextResponse } from "next/server";

import { requireBearerToken, lookupUserFromIdToken } from "@/lib/server/auth";
import { firestoreGetDocAsJson } from "@/lib/server/firestoreRest";
import { buildStructuraKey, type CerereAcreditare } from "@/lib/acreditari";
import { sendMailGmailSmtp } from "@/lib/server/smtp";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = `acr_resend_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  const logPrefix = `[acreditari][resend-email][${requestId}]`;
  const log = (...args: any[]) => console.log(logPrefix, ...args);
  const logErr = (...args: any[]) => console.error(logPrefix, ...args);
  try {
    const { id } = await ctx.params;
    log("start", { id });

    const idToken = await requireBearerToken(req);
    const authUser = await lookupUserFromIdToken(idToken);

    const profile = await firestoreGetDocAsJson<{ judetId?: string; structuraId?: string }>(`users/${authUser.uid}`, idToken);
    const judetId = String(profile?.judetId || "").toUpperCase();
    const structuraId = String(profile?.structuraId || "").toUpperCase();
    if (!judetId || !structuraId) return NextResponse.json({ error: "Profil incomplet (judetId/structuraId).", requestId }, { status: 403 });
    const currentKey = buildStructuraKey(judetId, structuraId);

    // Owner check
    const owner = await firestoreGetDocAsJson<{ uid?: string }>(`Judete/${judetId}/Structuri/${structuraId}/Settings/owner`, idToken);
    if (owner?.uid && owner.uid !== authUser.uid) return NextResponse.json({ error: "Forbidden", requestId }, { status: 403 });

    const cerere = await firestoreGetDocAsJson<CerereAcreditare>(`CereriAcreditare/${id}`, idToken);
    if (!cerere) return NextResponse.json({ error: "Not found", requestId }, { status: 404 });
    if (!Array.isArray((cerere as any).structuraKeys) || !(cerere as any).structuraKeys.includes(currentKey)) {
      return NextResponse.json({ error: "Forbidden", requestId }, { status: 403 });
    }
    const st = String(((cerere as any).statusByStructura || {})?.[currentKey]?.status || "pending");
    if (st !== "approved") return NextResponse.json({ error: "Cererea nu este aprobată.", requestId }, { status: 400 });

    const to = String((cerere as any)?.jurnalist?.email || "").trim();
    if (!to) return NextResponse.json({ error: "Lipsește emailul jurnalistului.", requestId }, { status: 400 });

    const acreditareId = String((cerere as any)?.source?.acreditareId || "").trim();
    if (!acreditareId) return NextResponse.json({ error: "Lipsește acreditareId (backlink) pe cerere.", requestId }, { status: 400 });

    const gen = await firestoreGetDocAsJson<any>(`Judete/${judetId}/Structuri/${structuraId}/Settings/general`, idToken).catch(() => null);
    const replyTo = String(gen?.email || "").trim() || undefined;
    const smtpUser = process.env.SMTP_USER || "";
    const smtpPass = process.env.SMTP_PASS || "";
    if (!smtpUser || !smtpPass) {
      return NextResponse.json({ error: "SMTP neconfigurat (SMTP_USER/SMTP_PASS).", requestId }, { status: 500 });
    }

    const origin = new URL(req.url).origin;
    const downloadUrl = `${origin}/api/acreditari/${encodeURIComponent(acreditareId)}/pdf?variant=public`;
    const year = new Date().getFullYear();
    const structLabel = `${structuraId} ${judetId}`;

    log("email_attempt", { to, downloadUrl });
    await sendMailGmailSmtp({
      smtpUser,
      smtpPass,
      to,
      subject: `Acreditare acceptată ${structLabel}`,
      text:
        `Acreditarea dvs pe anul ${year} a fost acceptată la ${structLabel}.\n\n` +
        `Descarcă acreditarea:\n${downloadUrl}\n`,
      replyTo,
    });
    log("email_success", { to });

    return NextResponse.json({ ok: true, requestId, email: { to, sent: true, downloadUrl } });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "error";
    logErr("failed", { message: msg });
    if (msg === "missing_auth") return NextResponse.json({ error: "Missing Authorization", requestId }, { status: 401 });
    if (msg === "invalid_token") return NextResponse.json({ error: "Invalid token", requestId }, { status: 401 });
    return NextResponse.json({ error: "Resend failed", requestId }, { status: 500 });
  }
}


