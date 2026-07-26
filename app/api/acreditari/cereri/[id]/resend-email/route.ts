import { NextResponse } from "next/server";

import { requireBearerToken, lookupUserFromIdToken } from "@/lib/server/auth";
import { firestoreGetDocAsJson } from "@/lib/server/firestoreRest";
import {
  buildStructuraKey,
  resolveAcreditareFieldsForStructura,
  resolveAcreditareIdForStructura,
  yearFromDateLabel,
  type CerereAcreditare,
} from "@/lib/acreditari";
import { buildPublicAcreditarePdfUrl } from "@/lib/server/acreditarePdfToken";
import {
  createAcreditareLogger,
  errorLogFields,
  newAcreditareRequestId,
} from "@/lib/server/acreditareLogger";
import { sendMailGmailSmtp } from "@/lib/server/smtp";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newAcreditareRequestId("acr_resend");
  let logger = createAcreditareLogger({ area: "resend-email", requestId });
  try {
    const { id } = await ctx.params;
    logger.info("start", { cerereId: id });

    const idToken = await requireBearerToken(req);
    const authUser = await lookupUserFromIdToken(idToken);

    const profile = await firestoreGetDocAsJson<{ judetId?: string; structuraId?: string }>(`users/${authUser.uid}`, idToken);
    const judetId = String(profile?.judetId || "").toUpperCase();
    const structuraId = String(profile?.structuraId || "").toUpperCase();
    if (!judetId || !structuraId) {
      logger.warn("forbidden_incomplete_profile");
      return NextResponse.json({ error: "Profil incomplet (judetId/structuraId).", requestId }, { status: 403 });
    }
    logger = createAcreditareLogger({
      area: "resend-email",
      requestId,
      tenant: { judetId, structuraId, uid: authUser.uid },
    });
    const currentKey = buildStructuraKey(judetId, structuraId);

    const owner = await firestoreGetDocAsJson<{ uid?: string }>(`Judete/${judetId}/Structuri/${structuraId}/Settings/owner`, idToken);
    if (!owner?.uid || owner.uid !== authUser.uid) {
      logger.warn("forbidden_not_owner");
      return NextResponse.json({ error: "Forbidden: nu ești owner pentru această structură.", requestId }, { status: 403 });
    }

    const cerere = await firestoreGetDocAsJson<CerereAcreditare>(`CereriAcreditare/${id}`, idToken);
    if (!cerere) {
      logger.warn("not_found", { cerereId: id });
      return NextResponse.json({ error: "Not found", requestId }, { status: 404 });
    }
    if (!Array.isArray((cerere as any).structuraKeys) || !(cerere as any).structuraKeys.includes(currentKey)) {
      logger.warn("forbidden_wrong_structure", { cerereId: id });
      return NextResponse.json({ error: "Forbidden", requestId }, { status: 403 });
    }
    const st = String(((cerere as any).statusByStructura || {})?.[currentKey]?.status || "pending");
    if (st !== "approved") {
      logger.warn("not_approved", { cerereId: id, status: st });
      return NextResponse.json({ error: "Cererea nu este aprobată.", requestId }, { status: 400 });
    }

    const to = String((cerere as any)?.jurnalist?.email || "").trim();
    if (!to) {
      logger.warn("missing_recipient", { cerereId: id });
      return NextResponse.json({ error: "Lipsește emailul jurnalistului.", requestId }, { status: 400 });
    }

    const acreditareId = resolveAcreditareIdForStructura(cerere, currentKey, id);
    const existingAcr = await firestoreGetDocAsJson<any>(
      `Judete/${judetId}/Structuri/${structuraId}/Acreditari/${acreditareId}`,
      idToken
    );
    if (!existingAcr) {
      logger.warn("acreditare_missing", { cerereId: id, acreditareId });
      return NextResponse.json({ error: "Acreditarea emisă nu a fost găsită.", requestId }, { status: 404 });
    }

    const gen = await firestoreGetDocAsJson<any>(`Judete/${judetId}/Structuri/${structuraId}/Settings/general`, idToken).catch(() => null);
    const replyTo = String(gen?.email || "").trim() || undefined;
    const smtpUser = process.env.SMTP_USER || "";
    const smtpPass = process.env.SMTP_PASS || "";
    if (!smtpUser || !smtpPass) {
      logger.error("smtp_missing", { hasUser: !!smtpUser, hasPass: !!smtpPass });
      return NextResponse.json({ error: "SMTP neconfigurat (SMTP_USER/SMTP_PASS).", requestId }, { status: 500 });
    }

    const origin = new URL(req.url).origin;
    const downloadUrl = buildPublicAcreditarePdfUrl({
      origin,
      acreditareId,
      judetId,
      structuraId,
    });
    const fields = resolveAcreditareFieldsForStructura(cerere as any, currentKey);
    const year =
      yearFromDateLabel(String(existingAcr?.data || "")) ||
      yearFromDateLabel(fields.data) ||
      new Date().getFullYear();
    const structLabel = `${structuraId} ${judetId}`;

    logger.info("email_attempt", { to, downloadUrl, acreditareId, year });
    await sendMailGmailSmtp({
      smtpUser,
      smtpPass,
      to,
      subject: `Acreditare acceptată ${structLabel}`,
      text:
        `Acreditarea dvs pe anul ${year} a fost acceptată la ${structLabel}.\n\n` +
        `Descarcă acreditarea (link cu valabilitate limitată):\n${downloadUrl}\n` +
        `Cu stimă,\n` +
        `COMPARTIMENT INFORMARE RELAȚII PUBLICE`,
      replyTo,
    });
    logger.info("ok", { to, acreditareId });

    return NextResponse.json({ ok: true, requestId, email: { to, sent: true, downloadUrl } });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "error";
    logger.error("failed", errorLogFields(e));
    if (msg === "missing_auth") return NextResponse.json({ error: "Missing Authorization", requestId }, { status: 401 });
    if (msg === "invalid_token") return NextResponse.json({ error: "Invalid token", requestId }, { status: 401 });
    return NextResponse.json({ error: "Resend failed", requestId }, { status: 500 });
  }
}
