import { NextResponse } from "next/server";
import React from "react";
import { pdf } from "@react-pdf/renderer";
import { doc, getDoc } from "firebase/firestore";
import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";
import { AcreditarePdfDoc } from "@/app/(admin-irp)/components/pdf/AcreditarePdf";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { db } = initFirebase();

  let snap = await (async () => {
    try {
      const { judetId, structuraId } = getTenantContext();
      const ref = doc(doc(db, `Judete/${judetId}/Structuri/${structuraId}`), "Acreditari", id);
      const s = await getDoc(ref);
      if (s.exists()) return s;
    } catch {}
    return await getDoc(doc(db, "Acreditari", id));
  })();

  if (!snap.exists()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const d = snap.data() as any;

  // Struct settings
  let settings: any = null;
  try {
    const judetId = d.judetId || getTenantContext().judetId;
    const structuraId = d.structuraId || getTenantContext().structuraId;
    const sref = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Settings/general`);
    const s = await getDoc(sref);
    settings = s.exists() ? s.data() : null;
  } catch {}

  const origin = req.headers.get('origin') || `http://localhost:${process.env.PORT || 3000}`;

  function toDDMMYYYYDots(str?: string): string {
    const s = String(str || "").trim();
    if (!s) return "";
    // Normalize YYYY-MM-DD to DD.MM.YYYY
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[3]}.${m[2]}.${m[1]}`;
    // Convert DD/MM/YYYY or DD-MM-YYYY to dots
    const m2 = s.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
    if (m2) return `${m2[1]}.${m2[2]}.${m2[3]}`;
    return s.replace(/-/g, ".").replace(/\//g, ".");
  }

  const DocPdf = (
    <AcreditarePdfDoc
      settings={{
        headerLines: (settings?.headerLines as string[]) || [],
        logoUrlPublic: settings?.logoUrlPublic ? `${origin}${settings.logoUrlPublic}` : undefined,
        unitLabel: settings?.unitLabel,
        city: settings?.city,
        phone: settings?.phone,
        footerLines: settings?.footerLines || [],
        assetBaseUrl: origin,
      }}
      data={{
        numar: String(d?.numar || ""),
        dateLabel: toDDMMYYYYDots(d?.data),
        nume: d?.nume || "",
        legit: d?.legit || "",
        redactie: d?.redactie || "",
      }}
    />
  );

  const blob = await pdf(DocPdf).toBlob();
  return new NextResponse(blob, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="acreditare_${String(d?.nume || "").replace(/\W+/g, "_")}.pdf"`,
    },
  });
}


