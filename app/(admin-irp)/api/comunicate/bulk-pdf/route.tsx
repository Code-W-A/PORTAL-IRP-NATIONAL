import { NextResponse } from "next/server";
import React from "react";
import { pdf, Document } from "@react-pdf/renderer";
import { doc, getDoc } from "firebase/firestore";
import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";
import { createBicpPage } from "@/app/(admin-irp)/components/pdf/BicpPdf";

export async function POST(req: Request) {
  try {
    const { ids, variant } = (await req.json()) as { ids: string[]; variant?: "signed" | "public" };
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No ids provided" }, { status: 400 });
    }

    const v: "signed" | "public" = variant === "public" ? "public" : "signed";
    const { db } = initFirebase();

    const pages: React.ReactNode[] = [];
    let meta: any = null;
    try {
      const { judetId, structuraId } = getTenantContext();
      const ref = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Settings/general`);
      const s = await getDoc(ref);
      meta = s.exists() ? s.data() : null;
    } catch {}

    const origin = new URL(req.url).origin;
    const logoAbs = meta?.logoUrlPublic ? new URL(String(meta.logoUrlPublic), origin).toString() : undefined;

    for (const id of ids) {
      let snap = await (async () => {
        try {
          const { judetId, structuraId } = getTenantContext();
          const ref = doc(doc(db, `Judete/${judetId}/Structuri/${structuraId}`), "Comunicate", id);
          const s = await getDoc(ref);
          if (s.exists()) return s;
        } catch {}
        return await getDoc(doc(db, "Comunicate", id));
      })();
      if (!snap.exists()) continue;
      const d = snap.data() as any;
      const content = String(d?.comunicat || "");
      pages.push(
        createBicpPage({
          settings: {
            headerLines: (meta?.headerLines as string[]) || [],
            logoUrlPublic: logoAbs,
            secrecyLabel: meta?.secrecyLabel || "NESECRET",
            city: meta?.city,
            phone: meta?.phone,
            footerLines: (meta?.footerLines as string[]) || [],
            unitLabel: meta?.unitLabel || "",
            assetBaseUrl: origin,
          },
          data: {
            numar: String(d?.numarComunicat ?? d?.numar ?? ""),
            dateLabel: d?.data || "",
            purtator: d?.["purtator-cuvant"] || "",
            tipDocument: d?.nume || d?.tip || "",
            titlu: d?.titlu || "",
            continut: content,
            semnatar: { pentru: d?.pentru || "", functia: d?.functia || "", grad: d?.grad || "", nume: d?.numeSemnatar || "" },
          },
          variant: v,
        })
      );
    }

    if (!pages.length) {
      return NextResponse.json({ error: "No valid documents" }, { status: 404 });
    }

    const DocEl = <Document>{pages}</Document>;
    const blob = await pdf(DocEl).toBlob();
    return new NextResponse(blob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="comunicate_bulk.pdf"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}


