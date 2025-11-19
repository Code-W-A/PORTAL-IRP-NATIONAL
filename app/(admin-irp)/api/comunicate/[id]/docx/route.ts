import { NextResponse } from "next/server";
import { doc, getDoc } from "firebase/firestore";
import { initFirebase } from "@/lib/firebase";
import { buildBicpDocx } from "@/app/(admin-irp)/components/docx/BicpDocx";
import { getTenantContext } from "@/lib/tenant";
import { doc as docRef2 } from "firebase/firestore";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
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
  // Try to read per-tenant settings for filename order
  let filenameFormat: string | undefined;
  try {
    const { judetId, structuraId } = getTenantContext();
    const sref = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Settings/general`);
    const ss = await getDoc(sref);
    filenameFormat = (ss.exists() ? (ss.data() as any).filenameFormat : undefined) as string | undefined;
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
  const chosenNumar = (String(d?.numarRegistru || "").trim())
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

  const buffer = await buildBicpDocx(
    {
      headerLines: d.headerLines || [],
      // Încearcă să încarci logo-ul local sau din URL pentru a fi introdus în DOCX
      logoArrayBuffer: null,
      secrecyLabel: d.secrecyLabel || "NESECRET",
      city: d.city,
      phone: d.phone,
    },
    {
      numar: chosenNumar,
      dateLabel: displayDate,
      purtator: d?.["purtator-cuvant"] || "",
      tipDocument: d?.nume || d?.tip || "",
      titlu: d?.titlu || "",
      continut: String(d?.comunicat || ""),
      continutHtml: String(d?.comunicatHtml || ""),
      semnatar: { pentru: d?.pentru || "", functia: d?.functia || "", grad: d?.grad || "", nume: d?.numeSemnatar || "" },
    }
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
      "Content-Disposition": `attachment; filename="${slugifyFilename(base)}.docx"`,
    },
  });
}


