import React from "react";
import { NextResponse } from "next/server";
import { pdf } from "@react-pdf/renderer";

import { requireBearerToken, lookupUserFromIdToken } from "@/lib/server/auth";
import { firestoreGetDocAsJson } from "@/lib/server/firestoreRest";
import { CerereAcreditarePdfDoc } from "@/app/(admin-irp)/components/pdf/CerereAcreditarePdf";
import { buildStructuraKey, type CerereAcreditare } from "@/lib/acreditari";
import {
  createAcreditareLogger,
  errorLogFields,
  newAcreditareRequestId,
} from "@/lib/server/acreditareLogger";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newAcreditareRequestId("acr_cerere_pdf");
  let logger = createAcreditareLogger({ area: "cerere-pdf", requestId });
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
      area: "cerere-pdf",
      requestId,
      tenant: { judetId, structuraId, uid: authUser.uid },
    });
    const currentKey = buildStructuraKey(judetId, structuraId);

    const cerere = await firestoreGetDocAsJson<CerereAcreditare>(`CereriAcreditare/${id}`, idToken);
    if (!cerere) {
      logger.warn("not_found", { cerereId: id });
      return NextResponse.json({ error: "Not found", requestId }, { status: 404 });
    }
    if (!Array.isArray((cerere as any).structuraKeys) || !(cerere as any).structuraKeys.includes(currentKey)) {
      logger.warn("forbidden_wrong_structure", { cerereId: id });
      return NextResponse.json({ error: "Forbidden", requestId }, { status: 403 });
    }

    const origin = new URL(req.url).origin;
    const submittedAt = (cerere as any).submittedAt || (cerere as any).createdAt;

    const DocPdf = (
      <CerereAcreditarePdfDoc
        settings={{
          assetBaseUrl: origin,
          structuraLabel: `${structuraId} ${judetId}`,
        }}
        data={{
          id,
          submittedAt: typeof submittedAt === "string" ? submittedAt : "",
          structuriLabel: `${structuraId} ${judetId}`,
          media: (cerere as any).media,
          jurnalist: (cerere as any).jurnalist,
          consimtamant: (cerere as any).consimtamant,
        }}
      />
    );

    const blob = await pdf(DocPdf).toBlob();
    logger.info("ok", { cerereId: id, bytes: blob.size });
    return new NextResponse(blob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="cerere_${String((cerere as any)?.jurnalist?.numePrenume || id).replace(/\W+/g, "_")}.pdf"`,
        "X-Request-Id": requestId,
      },
    });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "error";
    logger.error("failed", errorLogFields(e));
    if (msg === "missing_auth") return NextResponse.json({ error: "Missing Authorization", requestId }, { status: 401 });
    if (msg === "invalid_token") return NextResponse.json({ error: "Invalid token", requestId }, { status: 401 });
    return NextResponse.json({ error: "PDF generation failed", requestId }, { status: 500 });
  }
}
