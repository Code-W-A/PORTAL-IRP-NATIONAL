import { NextResponse } from "next/server";
import React from "react";
import { pdf } from "@react-pdf/renderer";
import { collection, doc, getDoc, getDocs, collectionGroup, query, where, documentId, limit } from "firebase/firestore";
import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";
import { BicpPdfDoc } from "@/app/(admin-irp)/components/pdf/BicpPdf";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(_req.url);
  const variantParam = url.searchParams.get("variant");
  const variant = variantParam === "public" ? "public" : "signed";
  const disposition = url.searchParams.get("disposition") === "inline" ? "inline" : "attachment";
  const qpJudet = url.searchParams.get("judetId") || undefined;
  const qpStruct = url.searchParams.get("structuraId") || undefined;
  const debug = url.searchParams.get("debug") === "1" || process.env.NODE_ENV !== "production";
  const { db } = initFirebase();
  const tried: string[] = [];
  if (debug) {
    console.log("[PDF] request", { id, variant, disposition, qpJudet, qpStruct, url: _req.url });
  }
  // Try tenant-scoped first, fallback to root collection for older docs, and finally collection group
  const snap = await (async () => {
    if (qpJudet && qpStruct) {
      const ref = doc(doc(db, `Judete/${qpJudet}/Structuri/${qpStruct}`), "Comunicate", id);
      const s = await getDoc(ref);
      tried.push(ref.path);
      if (s.exists()) return s;
    }
    try {
      const { judetId, structuraId } = getTenantContext();
      const ref = doc(doc(db, `Judete/${judetId}/Structuri/${structuraId}`), "Comunicate", id);
      const s = await getDoc(ref);
      tried.push(ref.path);
      if (s.exists()) return s;
    } catch {}
    const legacy = await getDoc(doc(db, "Comunicate", id));
    tried.push(`Comunicate/${id}`);
    if (legacy.exists()) return legacy;
    try {
      const q = query(collectionGroup(db, "Comunicate"), where(documentId(), "==", id), limit(1));
      const cg = await getDocs(q);
      if (!cg.empty) return cg.docs[0];
    } catch {}
    return { exists: () => false } as any;
  })();
  if (!snap.exists()) {
    if (debug) console.warn("[PDF] not found", { id, tried });
    return NextResponse.json({ error: "Not found", tried }, { status: 404 });
  }
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
    // Prefer document-embedded tenant; else query params; else parse from ref path
    let judetId: string | undefined = d?.judetId || qpJudet;
    let structuraId: string | undefined = d?.structuraId || qpStruct;
    if (!(judetId && structuraId)) {
      try {
        const parts = (snap as any).ref?.path?.split("/") || [];
        const jIdx = parts.indexOf("Judete");
        const sIdx = parts.indexOf("Structuri");
        if (jIdx >= 0 && sIdx >= 0 && parts[jIdx + 1] && parts[sIdx + 1]) {
          judetId = judetId || parts[jIdx + 1];
          structuraId = structuraId || parts[sIdx + 1];
        }
      } catch {}
    }
    if (judetId && structuraId) {
      const path = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Settings/general`);
      const ms = await getDoc(path);
      meta = ms.exists() ? ms.data() : null;
      if (debug) console.log("[PDF] meta settings path", path.path, { hasMeta: !!meta });
    }
  } catch {}

  // Ensure logo URL is absolute to avoid FS resolution like C:\\sigle\\...
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
  function slugifyFilename(input: string): string {
    const map: Record<string, string> = {
      "ă": "a", "â": "a", "î": "i", "ș": "s", "ş": "s", "ț": "t", "ţ": "t",
      "Ă": "A", "Â": "A", "Î": "I", "Ș": "S", "Ş": "S", "Ț": "T", "Ţ": "T",
      "é": "e", "è": "e", "ê": "e", "ë": "e", "É": "E", "È": "E", "Ê": "E", "Ë": "E",
      "ó": "o", "ò": "o", "ô": "o", "ö": "o", "Ó": "O", "Ò": "O", "Ô": "O", "Ö": "O",
      "ú": "u", "ù": "u", "û": "u", "ü": "u", "Ú": "U", "Ù": "U", "Û": "U", "Ü": "U",
      "í": "i", "ì": "i", "ï": "i", "Í": "I", "Ì": "I", "Ï": "I",
      "ç": "c", "Ç": "C", "ñ": "n", "Ñ": "N"
    };
    const normalized = Array.from(input).map((ch) => map[ch] || ch).join("");
    return normalized
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-_.]+|[-_.]+$/g, "")
      .slice(0, 150) || "Document";
  }
  const filenameBase = slugifyFilename(String(title));
  const suffix = variant === "public" ? "_public" : "";
  return new NextResponse(blob, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filenameBase}${suffix}.pdf"`,
    },
  });
}


