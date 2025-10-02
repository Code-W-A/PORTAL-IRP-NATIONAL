import { NextResponse } from "next/server";
import { initFirebase } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const key = url.searchParams.get("key");
    const judetId = url.searchParams.get("judetId");
    const structuraId = url.searchParams.get("structuraId");
    if (!key || !judetId || !structuraId) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const { db } = initFirebase();
    const settingsRef = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Settings/general`);
    const snap = await getDoc(settingsRef);
    const meta = snap.exists() ? snap.data() as any : {};

    const templatePath = join(process.cwd(), "public", "templates", "pdf", key);
    const mod: any = await import("pdf-lib");
    const PDFDocument = mod.PDFDocument as any;
    const bytes = readFileSync(templatePath);
    const pdfDoc = await PDFDocument.load(bytes);
    const form = pdfDoc.getForm();
    const set = (name: string, val: string) => { try { const f = form.getTextField(name); if (f) f.setText(val ?? ""); } catch {} };

    set("numar", "____");
    set("data", new Date().toLocaleDateString("ro-RO"));
    set("purtator", "Purtător de cuvânt");
    set("tip_document", "COMUNICAT DE PRESĂ");
    set("titlu", "Previzualizare șablon PDF");
    set("continut", "Acesta este un text de previzualizare pentru a verifica alinierea și spațierile conținutului în șablonul PDF.");
    set("semnatar_pentru", "");
    set("semnatar_functia", "FUNCȚIA");
    set("semnatar_grad", "GRAD");
    set("semnatar_nume", "NUME");
    set("secrecy", meta?.secrecyLabel || "NESECRET");
    set("unit_label", meta?.unitLabel || "");
    set("header_lines", ((meta?.headerLines as string[]) || []).join("\n"));
    set("footer_lines", ((meta?.footerLines as string[]) || []).join("\n"));
    try { form.flatten(); } catch {}

    const out = await pdfDoc.save();
    return new NextResponse(Buffer.from(out), { headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: "Preview failed" }, { status: 500 });
  }
}


