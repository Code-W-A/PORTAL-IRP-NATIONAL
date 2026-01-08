import React from "react";
import { NextResponse } from "next/server";
import { pdf } from "@react-pdf/renderer";

import { requireBearerToken, lookupUserFromIdToken } from "@/lib/server/auth";
import { firestoreGetDocAsJson } from "@/lib/server/firestoreRest";
import { buildStructuraKey, type CerereAcreditare } from "@/lib/acreditari";
import { AcreditarePdfDoc } from "@/app/(admin-irp)/components/pdf/AcreditarePdf";

function toDDMMYYYYSlashes(str?: string): string {
  const s = String(str || "").trim();
  if (!s) return "";
  // Normalize YYYY-MM-DD to DD/MM/YYYY
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  // Convert DD.MM.YYYY or DD-MM-YYYY to slashes
  const m2 = s.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (m2) return `${m2[1]}/${m2[2]}/${m2[3]}`;
  const m3 = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m3) return `${m3[1]}/${m3[2]}/${m3[3]}`;
  return s.replace(/\./g, "/").replace(/-/g, "/");
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const variantRaw = String(url.searchParams.get("variant") || "").toLowerCase();
    const variant = variantRaw === "public" ? "public" : "signed";

    const idToken = await requireBearerToken(req);
    const authUser = await lookupUserFromIdToken(idToken);

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

    const origin = new URL(req.url).origin;
    const gen = await firestoreGetDocAsJson<any>(`Judete/${judetId}/Structuri/${structuraId}/Settings/general`, idToken).catch(() => null);

    const nr = String((cerere as any)?.acreditare?.numar || "").trim();
    const dt = String((cerere as any)?.acreditare?.data || "").trim();
    const nume = String((cerere as any)?.jurnalist?.numePrenume || "");
    const legit = String((cerere as any)?.jurnalist?.legitimatie?.numar || "");
    const redactie = String((cerere as any)?.media?.denumire || "");

    const DocPdf = (
      <AcreditarePdfDoc
        settings={{
          headerLines: (gen?.headerLines as string[]) || [],
          logoUrlPublic: gen?.logoUrlPublic ? new URL(String(gen.logoUrlPublic), origin).toString() : undefined,
          unitLabel: gen?.unitLabel,
          city: gen?.city,
          phone: gen?.phone,
          footerLines: gen?.footerLines || [],
          acreditareSemnatarStanga: gen?.acreditareSemnatarStanga,
          acreditareSemnatarDreapta: gen?.acreditareSemnatarDreapta,
          assetBaseUrl: origin,
        }}
        variant={variant as any}
        data={{
          numar: nr || "—",
          dateLabel: toDDMMYYYYSlashes(dt),
          nume,
          legit,
          redactie,
        }}
      />
    );

    const blob = await pdf(DocPdf).toBlob();
    const suffix = variant === "public" ? "_fara_semnaturi" : "_cu_semnaturi";
    return new NextResponse(blob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="acreditare_${String(nume || id).replace(/\W+/g, "_")}${suffix}.pdf"`,
      },
    });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "error";
    if (msg === "missing_auth") return NextResponse.json({ error: "Missing Authorization" }, { status: 401 });
    if (msg === "invalid_token") return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}


