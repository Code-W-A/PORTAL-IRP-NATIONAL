"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { addDoc, collection, doc, getDoc, getDocs, serverTimestamp, Timestamp } from "firebase/firestore";
import { initFirebase } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { getTenantContext } from "@/lib/tenant";
import { pdf } from "@react-pdf/renderer";
import { BicpPdfDoc } from "@/app/(admin-irp)/components/pdf/BicpPdf";
import { FileText, UserCheck, FilePlus2, Link as LinkIcon } from "lucide-react";

type Semnatar = {
  key: string;
  numeSemnatar: string;
  pentru: string;
  functia: string;
  grad: string;
};

const SEMNATARI: Semnatar[] = [
  { key: "hantar", numeSemnatar: "HANTĂR Alfred", pentru: "p.INSPECTOR ȘEF", functia: "PRIM-ADJUNCT INSPECTOR ȘEF", grad: "Colonel" },
  { key: "florea", numeSemnatar: "ing. FLOREA Cristian-Claudiu", pentru: "", functia: "INSPECTOR ȘEF", grad: "Colonel" },
];

const TIPURI = [
  "Buletin Informativ",
  "Comunicat de Presă",
  "Știre",
  "Declarație de presă",
  "Conferință de presă",
  "Invitație",
  "Interviu",
  "Anunț",
  "Eveniment de presă",
  "Drept la replică",
];

const PURTATORI_FALLBACK = ["Locotenent Popescu Radu", "plt.adj. Oprea Ovidiu"] as const;

function todayYMD() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function formatRO(d: string) {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function tipToShort(tip: string): "BI" | "PC" | "CI" {
  if (tip === "Buletin Informativ") return "BI";
  if (tip === "Comunicat de Presă") return "PC";
  return "PC";
}

export default function CreateBicpPage() {
  const { db, app } = initFirebase();
  const router = useRouter();
  const [numarComunicat, setNumarComunicat] = useState("");
  const [numarInregistrare, setNumarInregistrare] = useState("");
  const [data, setData] = useState(todayYMD());
  const [selectedItem, setSelectedItem] = useState("");
  const [semnatarKey, setSemnatarKey] = useState<string>("");
  const [purtatoriSettings, setPurtatoriSettings] = useState<string[]>([]);
  const [purtatorCuvant, setPurtatorCuvant] = useState<string>(PURTATORI_FALLBACK[0]);
  const [titlu, setTitlu] = useState("");
  const [comunicat, setComunicat] = useState("");
  const [comunicatHtml, setComunicatHtml] = useState("");
  function htmlToPlainText(html: string): string {
    if (!html) return "";
    const withBreaks = html
      .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
      .replace(/<br\s*\/?>(\n)?/gi, "\n");
    const text = withBreaks.replace(/<[^>]+>/g, "");
    return text.replace(/\n{3,}/g, "\n\n").trim();
  }

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<any | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [semnatariSettings, setSemnatariSettings] = useState<{ functia: string; grad: string; nume: string }[]>([]);
  const semnatar = useMemo(() => {
    if (semnatarKey && semnatarKey.startsWith("settings:")) {
      const idx = Number(semnatarKey.split(":")[1]);
      const s = semnatariSettings[idx];
      return s ? { key: `settings:${idx}`, numeSemnatar: s.nume, pentru: "", functia: s.functia, grad: s.grad } as Semnatar : null;
    }
    return SEMNATARI.find((s) => s.key === semnatarKey) || null;
  }, [semnatarKey, semnatariSettings]);

  // Auto-populate numbers from Firestore (max + 1)
  useEffect(() => {
    (async () => {
      try {
        const { judetId, structuraId } = getTenantContext();
        const snap = await getDocs(collection(doc(db, `Judete/${judetId}/Structuri/${structuraId}`), "Comunicate"));
        let maxComunicat = 0;
        let maxInreg = 0;
        for (const d of snap.docs) {
          const v = d.data() as any;
          const n1 = Number(v.numarComunicat || v.numar);
          const n2 = Number(v.numarInregistrare || 0);
          if (!Number.isNaN(n1)) maxComunicat = Math.max(maxComunicat, n1);
          if (!Number.isNaN(n2)) maxInreg = Math.max(maxInreg, n2);
        }
        setNumarComunicat(String(maxComunicat + 1));
        setNumarInregistrare(String(maxInreg + 1));
      } catch {}
    })();
  }, [db]);

  // Load struct settings for preview (header, logo, footer)
  useEffect(() => {
    (async () => {
      try {
        const { judetId, structuraId } = getTenantContext();
        const ref = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Settings/general`);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data() as any;
          setSettings(d);
          if (Array.isArray(d.semnatari)) setSemnatariSettings(d.semnatari);
          if (!semnatarKey) {
            if (Array.isArray(d.semnatari) && d.semnatari.length > 0) {
              setSemnatarKey(`settings:0`);
            } else if (SEMNATARI.length > 0) {
              setSemnatarKey(SEMNATARI[0].key);
            }
          }
          if (Array.isArray(d.purtatori)) setPurtatoriSettings(d.purtatori.map((p:any)=>p.nume));
          if (typeof d.purtatorIndex === 'number' && Array.isArray(d.purtatori) && d.purtatori[d.purtatorIndex]) setPurtatorCuvant(d.purtatori[d.purtatorIndex].nume);
        }
      } catch {}
    })();
  }, [db]);

  const canSubmit = useMemo(() => {
    const titleOk = titlu.trim().length > 0;
    const textOk = (comunicat && comunicat.trim().length > 0) || (comunicatHtml && htmlToPlainText(comunicatHtml).length > 0);
    return titleOk && textOk;
  }, [titlu, comunicat, comunicatHtml]);

  // Simple contentEditable editor
  const editorRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (editorRef.current && comunicatHtml && editorRef.current.innerHTML.trim() === "") {
      editorRef.current.innerHTML = comunicatHtml;
    }
  }, [comunicatHtml]);

  function sanitizeHtml(html: string): string {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const allowed = new Set(["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "a", "h2", "h3"]);
      const walk = (el: Element) => {
        Array.from(el.children).forEach((child) => {
          const tag = child.tagName.toLowerCase();
          if (!allowed.has(tag)) {
            const parent = child.parentElement!;
            while (child.firstChild) parent.insertBefore(child.firstChild, child);
            parent.removeChild(child);
          } else {
            if (tag === "a") {
              const a = child as HTMLAnchorElement;
              if (!a.getAttribute("href")) a.removeAttribute("href");
            }
            walk(child as Element);
          }
        });
      };
      walk(doc.body);
      return doc.body.innerHTML;
    } catch {
      return html;
    }
  }

  function onEditorInput() {
    if (!editorRef.current) return;
    const raw = editorRef.current.innerHTML || "";
    const html = sanitizeHtml(raw);
    setComunicatHtml(html);
    setComunicat(htmlToPlainText(html));
  }

  function exec(cmd: string, val?: string) {
    try {
      (editorRef.current as HTMLElement)?.focus();
      document.execCommand(cmd, false, val);
      onEditorInput();
    } catch {}
  }

  // Build PDF preview on the fly with debounce for smoother UX
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
              dateLabel: data ? data.split("-").reverse().join("/") : "__/__/____",
              purtator: purtatorCuvant || "",
              tipDocument: selectedItem || "",
              titlu: titlu || "",
              continut: comunicat || "",
              continutHtml: comunicatHtml || undefined,
              semnatar: {
                pentru: semnatar?.pentru || "",
                functia: semnatar?.functia || "",
                grad: semnatar?.grad || "",
                nume: semnatar?.numeSemnatar || "",
              },
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canSubmit) {
      setError("Completați câmpurile obligatorii");
      return;
    }
    setLoading(true);
    try {
      const payload: any = {
        numar: Number(numarComunicat),
        numarComunicat: String(numarComunicat).trim(),
        numarInregistrare: String(numarInregistrare).trim(),
        data: formatRO(data), // DD/MM/YYYY afișare
        dataTimestamp: Timestamp.fromDate(new Date(data)), // util pentru sortări
        nume: selectedItem,
        titlu: titlu.trim(),
        comunicat: comunicat.trim(), // text simplu pentru PDF/DOCX
        comunicatHtml: comunicatHtml.trim(), // HTML pentru prezentări viitoare
        numeAfisare: `${numarComunicat}-${selectedItem}-${titlu.trim()}`,
        pentru: semnatar?.pentru || "",
        functia: semnatar?.functia || "",
        grad: semnatar?.grad || "",
        numeSemnatar: semnatar?.numeSemnatar || "",
        ["purtator-cuvant"]: purtatorCuvant,
        // compat cu listă existentă
        tip: tipToShort(selectedItem),
        createdAt: serverTimestamp(),
        createdBy: app?.options.projectId || null,
      };

      const { judetId, structuraId } = getTenantContext();
      await addDoc(collection(doc(db, `Judete/${judetId}/Structuri/${structuraId}`), "Comunicate"), {
        ...payload,
        judetId,
        structuraId,
      });

      // Generare documente (opțional, fără salvare link în Storage în acest pas)
      // await fetch("/api/generate/pdf", { method: "POST", body: JSON.stringify({ title: payload.numeAfisare, content: payload.comunicat }), headers: { "Content-Type": "application/json" } });
      // await fetch("/api/generate/docx", { method: "POST", body: JSON.stringify({ title: payload.numeAfisare, content: payload.comunicat }), headers: { "Content-Type": "application/json" } });

      alert("Creat cu succes");
      router.replace("/lista-BICP");
    } catch (err) {
      setError("Eroare la salvare");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-xl">
                <FilePlus2 size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Crează Document BI/CP</h1>
                <p className="text-gray-600 text-lg mt-1">Completează informațiile pentru a genera un document oficial</p>
              </div>
            </div>
            <button 
              type="button" 
              onClick={() => setShowPreview((v) => !v)} 
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-sm transition-colors"
            >
              <FileText size={16} />
              {showPreview ? "Ascunde previzualizare" : "Arată previzualizare"}
            </button>
          </div>
        </div>
      <div className={showPreview ? "grid grid-cols-1 lg:grid-cols-2 gap-6 items-start" : "space-y-6"}>
        <form onSubmit={onSubmit} className="space-y-8">
          <div className="bg-white rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-100/50 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
                <FilePlus2 size={18} className="text-blue-600"/>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Identificare Document</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label htmlFor="numarComunicat" className="block text-sm font-medium text-gray-700 mb-2">Număr Comunicat</label>
                <input 
                  id="numarComunicat" 
                  placeholder="Numărul comunicatului" 
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" 
                  value={numarComunicat} 
                  onChange={(e) => setNumarComunicat(e.target.value)} 
                />
              </div>
              <div>
                <label htmlFor="numarInregistrare" className="block text-sm font-medium text-gray-700 mb-2">Număr Înregistrare</label>
                <input 
                  id="numarInregistrare" 
                  placeholder="Numărul de înregistrare" 
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" 
                  value={numarInregistrare} 
                  onChange={(e) => setNumarInregistrare(e.target.value)} 
                />
              </div>
              <div>
                <label htmlFor="data" className="block text-sm font-medium text-gray-700 mb-2">Data</label>
                <input 
                  id="data" 
                  type="date" 
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" 
                  value={data} 
                  onChange={(e) => setData(e.target.value)} 
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-100/50 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-green-100 rounded-xl flex items-center justify-center">
                <UserCheck size={18} className="text-green-600"/>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Semnături și Autorizări</h2>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Semnatar</label>
                <select 
                  value={semnatarKey} 
                  onChange={(e) => setSemnatarKey(e.target.value)} 
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                >
                  <option value="">Selectează semnatar</option>
                  {semnatariSettings.map((s, idx) => (
                    <option key={`settings:${idx}`} value={`settings:${idx}`}>{s.nume}</option>
                  ))}
                  {SEMNATARI.map((s) => (
                    <option key={s.key} value={s.key}>{s.numeSemnatar}</option>
                  ))}
                </select>
                {semnatar && (
                  <div className="text-sm text-gray-600 mt-2 p-3 bg-gray-50 rounded-lg">
                    {[semnatar.pentru, semnatar.functia, semnatar.grad].filter(Boolean).join(" • ")}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Purtător de cuvânt</label>
                <select 
                  value={purtatorCuvant} 
                  onChange={(e) => setPurtatorCuvant(e.target.value)} 
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                >
                  {(purtatoriSettings.length? purtatoriSettings : PURTATORI_FALLBACK).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-100/50 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-purple-100 rounded-xl flex items-center justify-center">
                <FileText size={18} className="text-purple-600"/>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Conținut Document</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tip document</label>
                <select 
                  value={selectedItem} 
                  onChange={(e) => setSelectedItem(e.target.value)} 
                  className="w-full md:w-80 border border-gray-300 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                >
                  <option value="">Selectează tip document</option>
                  {TIPURI.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="titlu" className="block text-sm font-medium text-gray-700 mb-2">Titlu</label>
                <input 
                  id="titlu" 
                  placeholder="Titlul documentului" 
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" 
                  value={titlu} 
                  onChange={(e) => setTitlu(e.target.value)} 
                />
              </div>
          </div>
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Conținut Document</label>
              <textarea
                className="w-full border border-gray-300 rounded-xl px-4 py-4 min-h-48 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors resize-y"
                placeholder="Scrieți conținutul documentului aici..."
                value={comunicat}
                onChange={(e) => { setComunicat(e.target.value); setComunicatHtml(""); }}
              />
              <p className="mt-2 text-sm text-gray-500">Textul va fi folosit pentru generarea PDF.</p>
            </div>
          </div>

       

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
              <strong>Eroare:</strong> {error}
            </div>
          )}

          <div className="sticky bottom-6 bg-white border border-gray-200/60 rounded-2xl p-6 shadow-xl shadow-gray-100/50">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {canSubmit ? (
                  <span className="text-green-600 font-medium">✓ Documentul este gata pentru creare</span>
                ) : (
                  <span>Completează câmpurile obligatorii pentru a continua</span>
                )}
              </div>
              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={() => history.back()} 
                  className="px-6 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-400 transition-colors"
                >
                  Înapoi
                </button>
                <button 
                  disabled={loading || !canSubmit} 
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Se creează...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <FilePlus2 size={18} />
                      Creează Document
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>

        {showPreview && (
          <div className="bg-white rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-100/50 p-6 lg:sticky lg:top-24">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center">
                <FileText size={18} className="text-orange-600"/>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Previzualizare Document</h3>
                <p className="text-sm text-gray-600">Randare identică cu documentul final</p>
              </div>
            </div>
            <div className="h-[75vh] bg-gray-50 rounded-xl overflow-hidden">
              {previewUrl ? (
                <iframe 
                  title="pdf-preview" 
                  src={previewUrl} 
                  className="w-full h-full border-0" 
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 font-medium">Se generează previzualizarea</p>
                    <p className="text-sm text-gray-500 mt-1">Vă rugăm să așteptați...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}


