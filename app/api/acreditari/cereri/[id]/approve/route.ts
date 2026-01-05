import { NextResponse } from "next/server";

import { requireBearerToken, lookupUserFromIdToken } from "@/lib/server/auth";
import {
  firestoreCreateDoc,
  firestoreGetDocAsJson,
  firestorePatchDoc,
} from "@/lib/server/firestoreRest";
import { buildStructuraKey, type CerereAcreditare } from "@/lib/acreditari";
import { sendMailGmailSmtp } from "@/lib/server/smtp";

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

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const idToken = await requireBearerToken(req);
    const authUser = await lookupUserFromIdToken(idToken);

    // Resolve tenant from user profile
    const profile = await firestoreGetDocAsJson<{ judetId?: string; structuraId?: string }>(`users/${authUser.uid}`, idToken);
    const judetId = String(profile?.judetId || "").toUpperCase();
    const structuraId = String(profile?.structuraId || "").toUpperCase();
    if (!judetId || !structuraId) return NextResponse.json({ error: "Profil incomplet (judetId/structuraId)." }, { status: 403 });

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
    const numar = `ACR-${new Date().getFullYear()}-${id.slice(0, 6).toUpperCase()}`;
    const acrDoc = {
      numar,
      data: ddmmyyyy(new Date()),
      dataTimestamp: { __timestamp: nowIso },
      nume: String(jurnalist?.numePrenume || ""),
      legit: nrLegit,
      redactie: String(media?.denumire || ""),
      email: String(jurnalist?.email || ""),
      judetId,
      structuraId,
      createdAt: { __timestamp: nowIso },
      updatedAt: { __timestamp: nowIso },
      source: { cerereId: id },
    };
    await firestoreCreateDoc(`Judete/${judetId}/Structuri/${structuraId}/Acreditari`, idToken, acrDoc);

    // Email (optional)
    const to = String(jurnalist?.email || "").trim();
    if (to) {
      const gen = await firestoreGetDocAsJson<{ email?: string }>(`Judete/${judetId}/Structuri/${structuraId}/Settings/general`, idToken);
      const replyTo = String(gen?.email || "").trim() || undefined;
      const smtpUser = process.env.SMTP_USER || "";
      const smtpPass = process.env.SMTP_PASS || "";
      if (smtpUser && smtpPass) {
        const structLabel = `${structuraId} ${judetId}`;
        await sendMailGmailSmtp({
          smtpUser,
          smtpPass,
          to,
          subject: `Acreditare acceptată ${structLabel}`,
          text: `Acreditarea dvs pe anul ${new Date().getFullYear()} a fost acceptată la ${structLabel}`,
          replyTo,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "error";
    if (msg === "missing_auth") return NextResponse.json({ error: "Missing Authorization" }, { status: 401 });
    if (msg === "invalid_token") return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    return NextResponse.json({ error: "Approve failed" }, { status: 500 });
  }
}


