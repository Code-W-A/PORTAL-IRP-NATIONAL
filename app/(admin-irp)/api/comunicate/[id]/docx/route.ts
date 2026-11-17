import { NextResponse } from "next/server";
import { collectionGroup, doc, documentId, getDoc, getDocs, limit, query, where } from "firebase/firestore";
import { initFirebase } from "@/lib/firebase";
import { buildBicpDocx } from "@/app/(admin-irp)/components/docx/BicpDocx";
import { getTenantContext } from "@/lib/tenant";
import { JUDETE } from "@/lib/judete";
import { BICP_DOCX_VARIANTS, parseBicpDocxVariant } from "@/lib/bicp/docxVariants";
import { buildPurtatorSignatureUrl, normalizePurtatorSignatureKey } from "@/lib/pdf/purtatorSignatures";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    return await generateDocxResponse(_req, ctx);
  } catch {
    console.error("[DOCX] Document generation failed");
    return NextResponse.json({ error: "Nu s-a putut genera documentul DOCX. Încearcă din nou." }, { status: 500 });
  }
}

async function generateDocxResponse(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(_req.url);
  const variant = parseBicpDocxVariant(url.searchParams.get("variant"));
  if (!variant) return NextResponse.json({ error: "Variantă DOCX necunoscută." }, { status: 400 });
  const qpJudet = url.searchParams.get("judetId") || undefined;
  const qpStruct = url.searchParams.get("structuraId") || undefined;
  const debug = url.searchParams.get("debug") === "1" || process.env.NODE_ENV !== "production";
  const { db } = initFirebase();
  const tried: string[] = [];
  // Try tenant-scoped first (prefer query params), fallback to root collection, then collection group
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
  if (!snap.exists()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const d = snap.data() as any;
  // Try to read per-tenant settings for filename order
  let filenameFormat: string | undefined;
  let metaSettings: any | null = null;
  let effectiveJudetId: string | undefined;
  let effectiveStructuraId: string | undefined;
  try {
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
      const sref = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Settings/general`);
      const ss = await getDoc(sref);
      if (ss.exists()) {
        metaSettings = ss.data();
        filenameFormat = (metaSettings as any).filenameFormat as string | undefined;
      }
      if (debug) console.log("[DOCX] meta settings path", sref.path, { hasMeta: !!metaSettings });
    }
  } catch {}

  // Helpers (align with PDF route)
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
  const chosenNumar = (variant === "signed" && String(d?.numarRegistru || "").trim())
    ? String(d.numarRegistru).trim()
    : String(d?.numarComunicat ?? d?.numar ?? "");
  let displayDate = "";
  try {
    if (d?.dataTimestamp?.toDate) {
      const date = d.dataTimestamp.toDate();
      const dd = String(date.getDate()).padStart(2, "0");
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const yyyy = String(date.getFullYear());
      displayDate = `${dd}.${mm}.${yyyy}`;
    } else {
      displayDate = ddmmyyyyWithDots(String(d?.data || ""));
    }
  } catch {
    displayDate = ddmmyyyyWithDots(String(d?.data || ""));
  }

  // Simple documents do not depend on letterhead or signature assets.
  const origin = new URL(_req.url).origin;
  async function readImage(imageUrl: string): Promise<ArrayBuffer> {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error("DOCX image unavailable");
    return res.arrayBuffer();
  }
  const logoArrayBuffer = variant !== "simple" && metaSettings?.logoUrlPublic
    ? await readImage(new URL(String(metaSettings.logoUrlPublic), origin).toString()) : null;
  let purtatorSignatureArrayBuffer: ArrayBuffer | null = null;
  if (variant === "signed" && metaSettings?.showSpokespersonBlock !== false && effectiveJudetId && effectiveStructuraId) {
    // Match the existing PDF: only eligible structures receive a signature image.
    const structure = await getDoc(doc(db, `Judete/${effectiveJudetId}/Structuri/${effectiveStructuraId}`));
    if (structure.exists() && structure.data()?.isAdmin === true) {
      purtatorSignatureArrayBuffer = await readImage(buildPurtatorSignatureUrl(
        normalizePurtatorSignatureKey(d?.purtatorSemnaturaKey), origin,
      ));
    }
  }

  // Compute structure display similar to PDF
  let structureDisplay: string | undefined;
  try {
    const judName = JUDETE.find((j) => j.id === effectiveJudetId)?.name || (effectiveJudetId || "");
    if (effectiveStructuraId && judName) {
      const isIgsu = String(effectiveStructuraId || "").toUpperCase().includes("IGSU");
      structureDisplay = isIgsu ? String(effectiveStructuraId || "") : `${effectiveStructuraId} ${judName}`;
    }
  } catch {}

  const buffer = await buildBicpDocx(
    {
      headerLines: (metaSettings?.headerLines as string[]) || d.headerLines || [],
      logoArrayBuffer,
      secrecyLabel: metaSettings?.secrecyLabel || d.secrecyLabel || "NESECRET",
      city: metaSettings?.city || d.city,
      phone: metaSettings?.phone || d.phone,
      email: metaSettings?.email || d.email,
      footerLines: metaSettings?.footerLines || [],
      unitLabel: metaSettings?.unitLabel || undefined,
      structureDisplay,
      showSpokespersonBlock: metaSettings?.showSpokespersonBlock,
      showHeaderTricolor: metaSettings?.showHeaderTricolor,
      showTricolorFooter: metaSettings?.showTricolorFooter,
    },
    {
      numar: chosenNumar,
      dateLabel: displayDate,
      purtator: d?.["purtator-cuvant"] || "",
      purtatorSignatureArrayBuffer,
      tipDocument: d?.nume || d?.tip || "",
      titlu: d?.titlu || "",
      continut: String(d?.comunicat || ""),
      continutHtml: String(d?.comunicatHtml || ""),
      semnatar: { pentru: d?.pentru || "", functia: d?.functia || "", grad: d?.grad || "", nume: d?.numeSemnatar || "" },
    },
    variant,
  );
  const uint8 = new Uint8Array(buffer);
  function buildNameByFormat(fmt: string | undefined, parts: { numar: string; tip: string; titlu: string; data: string }): string {
    const f = fmt || "numar-tip-titlu";
    if (f === "tip-data-titlu") {
      const left = [parts.tip, parts.data].filter(Boolean).join(" ");
      return [left, parts.titlu].filter(Boolean).join(" - ");
    }
    return [parts.numar, parts.tip, parts.titlu].filter(Boolean).join("-");
  }
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

  const base = buildNameByFormat(filenameFormat, {
    numar: chosenNumar,
    tip: String(d?.nume || d?.tip || ""),
    titlu: String(d?.titlu || ""),
    data: displayDate,
  }) || "document";

  return new Response(uint8, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${slugifyFilename(base)}_${BICP_DOCX_VARIANTS.find((item) => item.value === variant)!.suffix}.docx"`,
      "Cache-Control": "private, no-store",
    },
  });
}


