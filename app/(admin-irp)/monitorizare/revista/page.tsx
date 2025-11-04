"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs } from "firebase/firestore";
import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";
import { pdf } from "@react-pdf/renderer";
import { RevistaPresaPdf } from "@/app/(admin-irp)/components/pdf/RevistaPresaPdf";
import { BookOpen, Calendar, Hash, User, Eye, Download, FileText } from "lucide-react";

export default function RevistaPresaPage() {
  const { db } = initFirebase();
  const [from, setFrom] = useState<string>(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10));
  const [to, setTo] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [numar, setNumar] = useState("");
  const [purtator, setPurtator] = useState("");
  const [purtatori, setPurtatori] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { judetId, structuraId } = getTenantContext();
        const sref = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Settings/general`);
        const ss = await (await import("firebase/firestore")).getDoc(sref);
        if (ss.exists()) {
          const d = ss.data() as any;
          if (Array.isArray(d.purtatori)) setPurtatori(d.purtatori.map((p: any) => p.nume));
        }
      } catch {}
    })();
  }, [db]);

  const perioadaLabel = useMemo(() => {
    const f = formatRO(from); const t = formatRO(to);
    return f === t ? f : `${f} – ${t}`;
  }, [from, to]);

  async function buildPreview() {
    try {
      setLoading(true);
      const { judetId, structuraId } = getTenantContext();
      const base = collection(doc(db, `Judete/${judetId}/Structuri/${structuraId}`), "MonitorizarePresa");
      const all = await getDocs(base);
      const fDate = new Date(from); const tDate = new Date(to);
      const rows = all.docs.map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((x: any) => {
          const ts = x.dataTimestamp?.toDate ? x.dataTimestamp.toDate() : parseRO(x.data);
          return ts && ts >= fDate && ts <= tDate;
        })
        .map((x: any) => ({ titlu: x.titlu, continut: x.continut, redactie: x.redactie }));

      const origin = window.location.origin;
      const blob = await pdf(
        <RevistaPresaPdf
          settings={{ assetBaseUrl: origin }}
          data={{
            numar: numar || "—",
            dateLabel: formatRO(new Date().toISOString().slice(0,10)),
            perioadaLabel,
            purtator: purtator || undefined,
            items: rows,
          }}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header modern */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-gray-900 inline-flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-rose-500 to-rose-600 rounded-xl flex items-center justify-center">
              <BookOpen size={18} className="text-white" />
            </div>
            Revista presei
          </div>
          <div className="text-sm text-gray-600 mt-1">Generează un raport complet cu materialele monitorizate din presă</div>
        </div>
      </div>

      {/* Configuration Form */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-blue-600" />
            <h3 className="font-medium text-gray-900">Configurare revista</h3>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Perioada de la</label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="date" 
                  value={from} 
                  onChange={(e)=>setFrom(e.target.value)} 
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none" 
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Perioada până la</label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="date" 
                  value={to} 
                  onChange={(e)=>setTo(e.target.value)} 
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none" 
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Numărul documentului</label>
              <div className="relative">
                <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  value={numar} 
                  onChange={(e)=>setNumar(e.target.value)} 
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none" 
                  placeholder="ex. 15" 
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Întocmit de (purtător)</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <select 
                  value={purtator} 
                  onChange={(e)=>setPurtator(e.target.value)} 
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none appearance-none bg-white"
                >
                  <option value="">(nespecificat)</option>
                  {purtatori.map((p)=> <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button 
          onClick={buildPreview} 
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <Eye size={16} />
          {loading ? "Se generează..." : "Generează previzualizare"}
        </button>
        {previewUrl && (
          <a 
            href={previewUrl} 
            download={`revista_presei_${perioadaLabel.replace(/\W+/g,'_')}.pdf`} 
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
          >
            <Download size={16} />
            Descarcă PDF
          </a>
        )}
      </div>

      {/* Preview */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Eye size={16} className="text-blue-600" />
            <h3 className="font-medium text-gray-900">Previzualizare PDF</h3>
            {perioadaLabel && (
              <span className="text-sm text-gray-600">— Perioada: {perioadaLabel}</span>
            )}
          </div>
        </div>
        <div className="p-6">
          <div className="h-[70vh] bg-gray-50 rounded-lg border border-gray-200">
            {previewUrl ? (
              <iframe className="w-full h-full rounded-lg" src={previewUrl} />
            ) : (
              <div className="grid place-items-center h-full">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <BookOpen size={24} className="text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Previzualizare revista presei</h3>
                  <p className="text-gray-500 mb-6">Configurați perioada și apăsați "Generează previzualizare" pentru a vedea documentul.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function parseRO(s?: string) {
  if (!s) return undefined;
  const [dd, mm, yy] = s.split("/");
  if (!dd || !mm || !yy) return undefined;
  return new Date(Number(yy), Number(mm) - 1, Number(dd));
}
function formatRO(d: string) {
  const [y,m,dd] = d.split("-");
  return `${dd}/${m}/${y}`;
}


