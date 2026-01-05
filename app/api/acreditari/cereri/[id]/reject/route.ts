import { NextResponse } from "next/server";

import { requireBearerToken, lookupUserFromIdToken } from "@/lib/server/auth";
import { firestoreGetDocAsJson, firestorePatchDoc } from "@/lib/server/firestoreRest";
import { buildStructuraKey, type CerereAcreditare } from "@/lib/acreditari";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const idToken = await requireBearerToken(req);
    const authUser = await lookupUserFromIdToken(idToken);

    const profile = await firestoreGetDocAsJson<{ judetId?: string; structuraId?: string }>(`users/${authUser.uid}`, idToken);
    const judetId = String(profile?.judetId || "").toUpperCase();
    const structuraId = String(profile?.structuraId || "").toUpperCase();
    if (!judetId || !structuraId) return NextResponse.json({ error: "Profil incomplet (judetId/structuraId)." }, { status: 403 });

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
      status: "rejected",
      decidedAt: { __timestamp: nowIso },
      decidedByUid: authUser.uid,
      decidedByEmail: authUser.email || null,
    };

    await firestorePatchDoc(`CereriAcreditare/${id}`, idToken, {
      statusByStructura,
      updatedAt: { __timestamp: nowIso },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "error";
    if (msg === "missing_auth") return NextResponse.json({ error: "Missing Authorization" }, { status: 401 });
    if (msg === "invalid_token") return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    return NextResponse.json({ error: "Reject failed" }, { status: 500 });
  }
}


