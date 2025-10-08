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
      numar: String(d?.numarComunicat ?? d?.numar ?? ""),
      dateLabel: d?.data || "",
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
  const base = buildNameByFormat(filenameFormat, {
    numar: String(d?.numarComunicat ?? d?.numar ?? ""),
    tip: String(d?.nume || d?.tip || ""),
    titlu: String(d?.titlu || ""),
    data: String(d?.data || ""),
  }) || "document";

  return new Response(uint8, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^[-_.]+|[-_.]+$/g, "").slice(0,150) || "document"}.docx"`,
    },
  });
}


