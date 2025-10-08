import { NextResponse } from "next/server";
import React from "react";
import { pdf } from "@react-pdf/renderer";
import { collection, doc, getDoc, getDocs, collectionGroup, query, where, documentId, limit } from "firebase/firestore";
import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";
import { JUDETE } from "@/lib/judete";
import { BicpPdfDoc } from "@/app/(admin-irp)/components/pdf/BicpPdf";
import { readFileSync } from "fs";
import { join } from "path";

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
  let effectiveJudetId: string | undefined;
  let effectiveStructuraId: string | undefined;
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
      effectiveJudetId = judetId;
      effectiveStructuraId = structuraId;
      const path = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Settings/general`);
      const ms = await getDoc(path);
      meta = ms.exists() ? ms.data() : null;
      if (debug) console.log("[PDF] meta settings path", path.path, { hasMeta: !!meta });
    }
  } catch {}

  // Ensure logo URL is absolute to avoid FS resolution like C:\\sigle\\...
  const origin = new URL(_req.url).origin;
  const logoAbs = meta?.logoUrlPublic ? new URL(String(meta.logoUrlPublic), origin).toString() : undefined;

  // Compute structure display explicitly (avoid server default DB/ISU)
  const judName = JUDETE.find((j) => j.id === effectiveJudetId)?.name || (effectiveJudetId || "");
  const structureDisplay = effectiveStructuraId && judName ? `${effectiveStructuraId} ${judName}` : undefined;

  // Choose displayed number: use registry number only for signed variant
  const chosenNumar = (variant === "signed" && String(d?.numarRegistru || "").trim())
    ? String(d.numarRegistru).trim()
    : String(d?.numarComunicat ?? d?.numar ?? "");

  function toDDMMYYYY(str?: string): string {
    const s = String(str || "").trim();
    if (!s) return "";
    if (s.includes("/")) {
      return s.split("/").map((x) => x.trim()).join("-");
    }
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return s;
  }
  function ddmmyyyyWithDots(str?: string): string {
    const ddmmyyyy = toDDMMYYYY(str);
    const m = ddmmyyyy.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (m) return `${m[1]}.${m[2]}.${m[3]}`;
    return ddmmyyyy.replace(/-/g, ".");
  }

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
        structureDisplay,
        assetBaseUrl: new URL("/", _req.url).origin,
      }}
      data={{
        numar: chosenNumar,
        dateLabel: ddmmyyyyWithDots(d?.data),
        purtator: d?.["purtator-cuvant"] || "",
        tipDocument: d?.nume || d?.tip || "",
        titlu: d?.titlu || "",
        continut: content,
        semnatar: { pentru: d?.pentru || "", functia: d?.functia || "", grad: d?.grad || "", nume: d?.numeSemnatar || "" },
      }}
      variant={variant as any}
    />
  );

  // If a local PDF template is configured in settings, fill its fields
  const templateKey = meta?.pdfTemplateKey as string | undefined; // e.g., "BICP-standard.pdf"
  if (templateKey) {
    try {
      // @ts-ignore - module will be present at build time
      const mod: any = await import("pdf-lib");
      const PDFDocument = mod.PDFDocument as any;
      const templatePath = join(process.cwd(), "public", "templates", "pdf", templateKey);
      const existingPdfBytes = readFileSync(templatePath);
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const form = pdfDoc.getForm();
      const set = (name: string, val: string) => {
        const field = form.getTextField(name);
        if (field) field.setText(val ?? "");
      };
      set("numar", chosenNumar);
      set("data", ddmmyyyyWithDots(d?.data));
      set("purtator", d?.["purtator-cuvant"] || "");
      set("tip_document", d?.nume || d?.tip || "");
      set("titlu", d?.titlu || "");
      set("continut", content);
      set("semnatar_pentru", d?.pentru || "");
      set("semnatar_functia", d?.functia || "");
      set("semnatar_grad", d?.grad || "");
      set("semnatar_nume", d?.numeSemnatar || "");
      set("secrecy", variant === "signed" ? (meta?.secrecyLabel || "NESECRET") : "");
      set("unit_label", meta?.unitLabel || "");
      // Header/footer lines joined for simple templates
      set("header_lines", ((meta?.headerLines as string[]) || []).join("\n"));
      set("footer_lines", ((meta?.footerLines as string[]) || []).join("\n"));
      try { form.flatten(); } catch {}
      const filled = await pdfDoc.save();
      const filenameBase = slugifyFilename(String(title));
      const suffix = variant === "public" ? "_public" : "";
      return new NextResponse(Buffer.from(filled), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `${disposition}; filename="${filenameBase}${suffix}.pdf"`,
        },
      });
    } catch (e) {
      if (debug) console.warn("[PDF] template fill failed, fallback to renderer", e);
    }
  }

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
      .replace(/[^a-zA-Z0-9._\-\s]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 150) || "Document";
  }
  // Build filename based on per-tenant settings order (default: numar-tip-titlu)
  function buildNameByFormat(fmt: string | undefined, parts: { numar: string; tip: string; titlu: string; data: string }): string {
    const f = fmt || "numar-tip-titlu";
    if (f === "tip-data-titlu") {
      const left = [parts.tip, parts.data].filter(Boolean).join(" ");
      return [left, parts.titlu].filter(Boolean).join(" - ");
    }
    return [parts.numar, parts.tip, parts.titlu].filter(Boolean).join("-");
  }
  const orderedBase = buildNameByFormat(meta?.filenameFormat as string | undefined, {
    numar: chosenNumar,
    tip: String(d?.nume || d?.tip || ""),
    titlu: String(d?.titlu || ""),
    data: ddmmyyyyWithDots(d?.data),
  });
  const filenameBase = slugifyFilename(orderedBase || String(title));
  const suffix = ""; // remove public suffix as requested
  return new NextResponse(blob, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filenameBase}${suffix}.pdf"`,
    },
  });
}


