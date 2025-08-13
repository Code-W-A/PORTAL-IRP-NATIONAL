import { NextResponse } from "next/server";
import React from "react";
import { pdf } from "@react-pdf/renderer";
import { collection, doc, getDoc } from "firebase/firestore";
import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";
import { BicpPdfDoc } from "@/app/(admin-irp)/components/pdf/BicpPdf";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(_req.url);
  const variantParam = url.searchParams.get("variant");
  const variant = variantParam === "public" ? "public" : "signed";
  const { db } = initFirebase();
  // Try tenant-scoped first, fallback to root collection for older docs
  let snap = await (async () => {
    try {
      const { judetId, structuraId } = getTenantContext();
      const ref = doc(doc(db, `Judete/${judetId}/Structuri/${structuraId}`), "Comunicate", id);
      const s = await getDoc(ref);
      if (s.exists()) return s;
    } catch {}
    return await getDoc(doc(db, "Comunicate", id));
  })();
  if (!snap.exists()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const d = snap.data() as any;
  const title = d?.numeAfisare || `${d?.numarComunicat ?? d?.numar} - ${d?.nume || d?.tip} - ${d?.titlu}` || "Document";
  const content = String(d?.comunicat || "");
  const metaNumar = (d?.numarComunicat ?? d?.numar) ?? "-";
  const metaData = d?.data || "-";
  const metaSemnatar = d?.numeSemnatar || "-";
  const metaLine = `Număr: ${metaNumar}  •  Data: ${metaData}  •  Semnatar: ${metaSemnatar}`;

  // Optionally read struct settings if meta is present (best effort)
  let meta: any = null;
  try {
    const judetId = d.judetId || getTenantContext().judetId;
    const structuraId = d.structuraId || getTenantContext().structuraId;
    const path = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Settings/general`);
    const ms = await getDoc(path);
    meta = ms.exists() ? ms.data() : null;
  } catch {}

  // Ensure logo URL is absolute to avoid FS resolution like C:\sigle\...
  const origin = new URL(_req.url).origin;
  const logoAbs = meta?.logoUrlPublic ? new URL(String(meta.logoUrlPublic), origin).toString() : undefined;

  const DocPdf = (
    <BicpPdfDoc
      settings={{
        headerLines: (meta?.headerLines as string[]) || [],
        logoUrlPublic: logoAbs,
        secrecyLabel: meta?.secrecyLabel || "NESECRET",
        city: meta?.city,
        phone: meta?.phone,
        footerLines: (meta?.footerLines as string[]) || [],
        unitLabel: meta?.unitLabel || "",
        assetBaseUrl: new URL("/", _req.url).origin,
      }}
      data={{
        numar: String(d?.numarComunicat ?? d?.numar ?? ""),
        dateLabel: d?.data || "",
        purtator: d?.["purtator-cuvant"] || "",
        tipDocument: d?.nume || d?.tip || "",
        titlu: d?.titlu || "",
        continut: content,
        semnatar: { pentru: d?.pentru || "", functia: d?.functia || "", grad: d?.grad || "", nume: d?.numeSemnatar || "" },
      }}
      variant={variant as any}
    />
  );

  const blob = await pdf(DocPdf).toBlob();
  const filenameBase = String(title).replace(/\W+/g, "_");
  const suffix = variant === "public" ? "_public" : "";
  return new NextResponse(blob, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filenameBase}${suffix}.pdf"`,
    },
  });
}


