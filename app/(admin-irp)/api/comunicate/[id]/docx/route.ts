import { NextResponse } from "next/server";
import { doc, getDoc } from "firebase/firestore";
import { initFirebase } from "@/lib/firebase";
import { buildBicpDocx } from "@/app/(admin-irp)/components/docx/BicpDocx";
import { getTenantContext } from "@/lib/tenant";

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
  return new Response(uint8, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="document.docx"`,
    },
  });
}


