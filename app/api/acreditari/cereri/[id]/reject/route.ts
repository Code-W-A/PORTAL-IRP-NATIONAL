import { NextResponse } from "next/server";

import { requireBearerToken, lookupUserFromIdToken } from "@/lib/server/auth";
import { firestoreGetDocAsJson, firestorePatchDoc } from "@/lib/server/firestoreRest";
import { buildStructuraKey, resolveAcreditareIdForStructura, type CerereAcreditare } from "@/lib/acreditari";
import {
  createAcreditareLogger,
  errorLogFields,
  newAcreditareRequestId,
} from "@/lib/server/acreditareLogger";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newAcreditareRequestId("acr_reject");
  let logger = createAcreditareLogger({ area: "reject", requestId });
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
      area: "reject",
      requestId,
      tenant: { judetId, structuraId, uid: authUser.uid },
    });

    const owner = await firestoreGetDocAsJson<{ uid?: string }>(`Judete/${judetId}/Structuri/${structuraId}/Settings/owner`, idToken);
    if (!owner?.uid || owner.uid !== authUser.uid) {
      logger.warn("forbidden_not_owner");
      return NextResponse.json({ error: "Forbidden: nu ești owner pentru această structură.", requestId }, { status: 403 });
    }

    const currentKey = buildStructuraKey(judetId, structuraId);
    const cerere = await firestoreGetDocAsJson<CerereAcreditare>(`CereriAcreditare/${id}`, idToken);
    if (!cerere) {
      logger.warn("not_found", { cerereId: id });
      return NextResponse.json({ error: "Not found", requestId }, { status: 404 });
    }
    if (!Array.isArray((cerere as any).structuraKeys) || !(cerere as any).structuraKeys.includes(currentKey)) {
      logger.warn("forbidden_wrong_structura", { cerereId: id });
      return NextResponse.json({ error: "Forbidden", requestId }, { status: 403 });
    }

    const statusByStructura = { ...((cerere as any).statusByStructura || {}) };
    const currentStatus = { ...(statusByStructura[currentKey] || {}) };
    const existingStatus = String(currentStatus.status || "pending");

    if (existingStatus === "approved") {
      logger.warn("already_approved_block", { cerereId: id });
      return NextResponse.json(
        {
          error: "Cererea este deja aprobată. Pentru revocare, șterge acreditarea din „Lista acreditări”.",
          requestId,
        },
        { status: 409 }
      );
    }

    if (existingStatus === "rejected") {
      logger.info("already_rejected", { cerereId: id });
      return NextResponse.json({ ok: true, alreadyRejected: true, requestId });
    }

    const acreditareId = resolveAcreditareIdForStructura(cerere, currentKey, id);
    const existingAcr = await firestoreGetDocAsJson<any>(
      `Judete/${judetId}/Structuri/${structuraId}/Acreditari/${acreditareId}`,
      idToken
    );
    if (existingAcr) {
      logger.warn("issued_acreditare_blocks_reject", { cerereId: id, acreditareId });
      return NextResponse.json(
        {
          error: "Există deja o acreditare emisă pentru această cerere. Șterge-o din „Lista acreditări” înainte de respingere.",
          requestId,
          acreditareId,
        },
        { status: 409 }
      );
    }

    const nowIso = new Date().toISOString();
    statusByStructura[currentKey] = {
      ...currentStatus,
      status: "rejected",
      decidedAt: { __timestamp: nowIso },
      decidedByUid: authUser.uid,
      decidedByEmail: authUser.email || null,
    };

    await firestorePatchDoc(`CereriAcreditare/${id}`, idToken, {
      statusByStructura,
      updatedAt: { __timestamp: nowIso },
    });

    logger.info("ok", { cerereId: id });
    return NextResponse.json({ ok: true, requestId });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "error";
    logger.error("failed", errorLogFields(e));
    if (msg === "missing_auth") return NextResponse.json({ error: "Missing Authorization", requestId }, { status: 401 });
    if (msg === "invalid_token") return NextResponse.json({ error: "Invalid token", requestId }, { status: 401 });
    return NextResponse.json({ error: "Reject failed", requestId }, { status: 500 });
  }
}
