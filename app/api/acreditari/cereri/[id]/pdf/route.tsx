import React from "react";
import { NextResponse } from "next/server";
import { pdf } from "@react-pdf/renderer";

import { requireBearerToken, lookupUserFromIdToken } from "@/lib/server/auth";
import { firestoreGetDocAsJson } from "@/lib/server/firestoreRest";
import { CerereAcreditarePdfDoc } from "@/app/(admin-irp)/components/pdf/CerereAcreditarePdf";
import { buildStructuraKey, type CerereAcreditare } from "@/lib/acreditari";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const idToken = await requireBearerToken(req);
    const authUser = await lookupUserFromIdToken(idToken);

    // Read user profile to determine tenant (and rely on Firestore rules for auth)
    const profile = await firestoreGetDocAsJson<{ judetId?: string; structuraId?: string }>(`users/${authUser.uid}`, idToken);
    const judetId = String(profile?.judetId || "").toUpperCase();
    const structuraId = String(profile?.structuraId || "").toUpperCase();
    if (!judetId || !structuraId) return NextResponse.json({ error: "Profil incomplet (judetId/structuraId)." }, { status: 403 });
    const currentKey = buildStructuraKey(judetId, structuraId);

    const cerere = await firestoreGetDocAsJson<CerereAcreditare>(`CereriAcreditare/${id}`, idToken);
    if (!cerere) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!Array.isArray((cerere as any).structuraKeys) || !(cerere as any).structuraKeys.includes(currentKey)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // IMPORTANT: on Vercel, `origin` header can be missing; never fall back to localhost.
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
    return new NextResponse(blob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="cerere_${String((cerere as any)?.jurnalist?.numePrenume || id).replace(/\W+/g, "_")}.pdf"`,
      },
    });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "error";
    if (msg === "missing_auth") return NextResponse.json({ error: "Missing Authorization" }, { status: 401 });
    if (msg === "invalid_token") return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}


