"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, getDoc, serverTimestamp, Timestamp, updateDoc } from "firebase/firestore";
import { initFirebase } from "@/lib/firebase";
import { useParams, useRouter } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { pdf } from "@react-pdf/renderer";
import { BicpPdfDoc } from "@/app/(admin-irp)/components/pdf/BicpPdf";
import { FilePlus2, FileText } from "lucide-react";

export default function EditBicpPage() {
  const { db } = initFirebase();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const docId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<any | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  // fields
  const [numarComunicat, setNumarComunicat] = useState("");
  const [numarInregistrare, setNumarInregistrare] = useState("");
  const [data, setData] = useState("");
  const [selectedItem, setSelectedItem] = useState("");
  const [titlu, setTitlu] = useState("");
  const [comunicat, setComunicat] = useState("");
  const [comunicatHtml, setComunicatHtml] = useState("");
  const [semnatar, setSemnatar] = useState<{ pentru: string; functia: string; grad: string; nume: string }|null>(null);
  const [purtatorCuvant, setPurtatorCuvant] = useState<string>("");

  // load record + settings
  useEffect(() => {
    (async () => {
      try {
        const { judetId, structuraId } = getTenantContext();
        const ref = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Comunicate/${docId}`);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error("Documentul nu există");
        const d = snap.data() as any;
        setNumarComunicat(String(d.numarComunicat || d.numar || ""));
        setNumarInregistrare(String(d.numarInregistrare || ""));
        setData(d.dataTimestamp ? (d.dataTimestamp.toDate?.().toISOString?.().slice(0,10)) : "");
        setSelectedItem(String(d.nume || d.tip || ""));
        setTitlu(String(d.titlu || ""));
        setComunicat(String(d.comunicat || ""));
        setComunicatHtml(String(d.comunicatHtml || ""));
        setSemnatar({ pentru: d.pentru || "", functia: d.functia || "", grad: d.grad || "", nume: d.numeSemnatar || "" });
        setPurtatorCuvant(String(d["purtator-cuvant"] || ""));

        const settingsRef = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Settings/general`);
        const s = await getDoc(settingsRef);
        if (s.exists()) setSettings(s.data());
      } catch (e: any) {
        setError(e.message || "Eroare la încărcare");
      } finally {
        setLoading(false);
      }
    })();
  }, [db, docId]);

  // preview
  useEffect(() => {
    if (!showPreview) return;
    let url: string | null = null;
    const timeout = setTimeout(async () => {
      try {
        const docEl = (
          <BicpPdfDoc
            settings={{
              headerLines: settings?.headerLines || [],
              logoUrlPublic: settings?.logoUrlPublic,
              secrecyLabel: settings?.secrecyLabel,
              city: settings?.city,
              phone: settings?.phone,
              footerLines: settings?.footerLines || [],
              unitLabel: settings?.unitLabel,
            }}
            data={{
              numar: numarComunicat || "__",
              dateLabel: data ? data.split("-").reverse().join("-") : "__/__/____",
              purtator: purtatorCuvant || "",
              tipDocument: selectedItem || "",
              titlu: titlu || "",
              continut: comunicat || "",
              continutHtml: comunicatHtml || undefined,
              semnatar: { pentru: semnatar?.pentru || "", functia: semnatar?.functia || "", grad: semnatar?.grad || "", nume: semnatar?.nume || "" },
            }}
          />
        );
        const blob = await pdf(docEl).toBlob();
        url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      } catch {
        setPreviewUrl(null);
      }
    }, 200);
    return () => { clearTimeout(timeout); if (url) URL.revokeObjectURL(url); };
  }, [showPreview, settings, numarComunicat, data, purtatorCuvant, selectedItem, titlu, comunicat, comunicatHtml, semnatar]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { judetId, structuraId } = getTenantContext();
      const ref = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Comunicate/${docId}`);
      await updateDoc(ref, {
        numar: Number(numarComunicat),
        numarComunicat: String(numarComunicat).trim(),
        numarInregistrare: String(numarInregistrare).trim(),
        data,
        dataTimestamp: data ? Timestamp.fromDate(new Date(data)) : null,
        nume: selectedItem,
        titlu: titlu.trim(),
        comunicat: comunicat.trim(),
        comunicatHtml: comunicatHtml.trim(),
        pentru: semnatar?.pentru || "",
        functia: semnatar?.functia || "",
        grad: semnatar?.grad || "",
        numeSemnatar: semnatar?.nume || "",
        ["purtator-cuvant"]: purtatorCuvant,
        updatedAt: serverTimestamp(),
      });
      alert("Salvat");
      router.replace("/lista-BICP");
    } catch (e: any) {
      setError(e.message || "Eroare la salvare");
    }
  }

  if (loading) return <div className="p-6">Se încarcă…</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-xl">
              <FilePlus2 size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Editează Document BI/CP</h1>
              <p className="text-gray-600 text-lg mt-1">Modifică informațiile documentului</p>
            </div>
          </div>
          <button type="button" onClick={() => setShowPreview(v => !v)} className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-sm transition-colors">
            <FileText size={16} />
            {showPreview ? "Ascunde previzualizare" : "Arată previzualizare"}
          </button>
        </div>

        <div className={showPreview ? "grid grid-cols-1 lg:grid-cols-2 gap-6 items-start" : "space-y-6"}>
          <form onSubmit={onSave} className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-100/50 p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Număr Comunicat</label>
                  <input className="w-full border border-gray-300 rounded-xl px-4 py-3" value={numarComunicat} onChange={(e)=>setNumarComunicat(e.target.value)} />
                </div>
              
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data</label>
                  <input type="date" className="w-full border border-gray-300 rounded-xl px-4 py-3" value={data} onChange={(e)=>setData(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-100/50 p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tip document</label>
                <input className="w-full md:w-80 border border-gray-300 rounded-xl px-4 py-3" value={selectedItem} onChange={(e)=>setSelectedItem(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Titlu</label>
                <input className="w-full border border-gray-300 rounded-xl px-4 py-3" value={titlu} onChange={(e)=>setTitlu(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Conținut Document</label>
                <textarea className="w-full border border-gray-300 rounded-xl px-4 py-4 min-h-48" value={comunicat} onChange={(e)=>{ setComunicat(e.target.value); setComunicatHtml(""); }} />
                <p className="mt-2 text-sm text-gray-500">Dacă există HTML, acesta va fi folosit la randare.</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-100/50 p-6">
              <button className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-xl">Salvează</button>
            </div>
          </form>

          {showPreview && (
            <div className="bg-white rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-100/50 p-6 lg:sticky lg:top-24">
              <div className="h-[75vh] bg-gray-50 rounded-xl overflow-hidden">
                {previewUrl ? (
                  <iframe title="pdf-preview" src={previewUrl} className="w-full h-full border-0" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">Previzualizare indisponibilă</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


