"use client";
import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, doc, getDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";
import { useRouter } from "next/navigation";
import { Newspaper, Plus, Type, FileText, Link2, ThumbsUp, ThumbsDown, Minus, Radio, Tv, Monitor, Building2, Calendar } from "lucide-react";

const SENTIMENTE = [
  { key: "favorabil", label: "Favorabil" },
  { key: "neutru", label: "Neutru" },
  { key: "defavorabil", label: "Defavorabil" },
] as const;

const CANALE = [
  { key: "presa", label: "Presa scrisă / Agenții / Online" },
  { key: "tv", label: "Televiziune" },
  { key: "radio", label: "Radio" },
] as const;

export default function CreeazaMonitorizarePage() {
  const { db } = initFirebase();
  const router = useRouter();
  const [titlu, setTitlu] = useState("");
  const [continut, setContinut] = useState("");
  const [redactie, setRedactie] = useState("");
  const [link, setLink] = useState("");
  const [sentiment, setSentiment] = useState<typeof SENTIMENTE[number]["key"]>("favorabil");
  const [canal, setCanal] = useState<typeof CANALE[number]["key"]>("presa");
  const [data, setData] = useState(() => new Date().toISOString().slice(0,10));
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => titlu.trim() && sentiment && canal, [titlu, sentiment, canal]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      const { judetId, structuraId } = getTenantContext();
      const payload: any = {
        titlu: titlu.trim(),
        continut: continut.trim(),
        link: link.trim(),
        redactie: redactie.trim(),
        sentiment,
        canal,
        data: formatRO(data),
        dataTimestamp: Timestamp.fromDate(new Date(data)),
        createdAt: serverTimestamp(),
        judetId, structuraId,
      };
      await addDoc(collection(doc(db, `Judete/${judetId}/Structuri/${structuraId}`), "MonitorizarePresa"), payload);
      alert("Înregistrare adăugată");
      router.replace("/monitorizare/lista");
    } catch {
      alert("Eroare la salvare");
    } finally {
      setLoading(false);
    }
  }

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case "favorabil": return <ThumbsUp size={14} />;
      case "defavorabil": return <ThumbsDown size={14} />;
      default: return <Minus size={14} />;
    }
  };

  const getCanalIcon = (canal: string) => {
    switch (canal) {
      case "tv": return <Tv size={14} />;
      case "radio": return <Radio size={14} />;
      default: return <Monitor size={14} />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header modern */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-gray-900 inline-flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
              <Newspaper size={18} className="text-white" />
            </div>
            Monitorizare presă
          </div>
          <div className="text-sm text-gray-600 mt-1">Adaugă un nou material monitorizat din presă</div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        {/* Content Info */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Type size={16} className="text-blue-600" />
              <h3 className="font-medium text-gray-900">Conținut material</h3>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Titlu material</label>
              <div className="relative">
                <Type size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  value={titlu} 
                  onChange={(e)=>setTitlu(e.target.value)} 
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none" 
                  placeholder="Titlul materialului din presă" 
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Conținut (rezumat)</label>
              <div className="relative">
                <FileText size={16} className="absolute left-3 top-3 text-gray-400" />
                <textarea 
                  value={continut} 
                  onChange={(e)=>setContinut(e.target.value)} 
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none min-h-32 resize-y" 
                  placeholder="Rezumatul conținutului materialului..." 
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Link către material</label>
              <div className="relative">
                <Link2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  type="url"
                  value={link} 
                  onChange={(e)=>setLink(e.target.value)} 
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none" 
                  placeholder="https://exemplu.com/articol" 
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Redacție / Sursă (opțional)</label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                  value={redactie} 
                  onChange={(e)=>setRedactie(e.target.value)} 
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none" 
                  placeholder="ex. Agerpres, Digi24, Radio România" 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Classification */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Newspaper size={16} className="text-blue-600" />
              <h3 className="font-medium text-gray-900">Clasificare și metadata</h3>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sentiment</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {getSentimentIcon(sentiment)}
                  </div>
                  <select 
                    value={sentiment} 
                    onChange={(e)=>setSentiment(e.target.value as any)} 
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none appearance-none bg-white"
                  >
                    {SENTIMENTE.map((s)=> <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Canal media</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {getCanalIcon(canal)}
                  </div>
                  <select 
                    value={canal} 
                    onChange={(e)=>setCanal(e.target.value as any)} 
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none appearance-none bg-white"
                  >
                    {CANALE.map((c)=> <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data apariției</label>
                <div className="relative">
                  <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input 
                    type="date" 
                    value={data} 
                    onChange={(e)=>setData(e.target.value)} 
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none" 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button 
            type="submit"
            disabled={loading || !canSubmit} 
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm"
          >
            <Plus size={16} />
            {loading ? "Se salvează..." : "Salvează înregistrarea"}
          </button>
        </div>
      </form>
    </div>
  );
}

function formatRO(d: string) {
  if (!d) return "";
  const [y,m,dd] = d.split("-");
  return `${dd}/${m}/${y}`;
}


