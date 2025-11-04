"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs } from "firebase/firestore";
import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";
import Link from "next/link";
import { Newspaper, Plus, Search, Grid2X2, Rows2, ExternalLink, Calendar, ThumbsUp, ThumbsDown, Minus, Tv, Radio, Monitor } from "lucide-react";

type Item = { id: string; titlu: string; continut?: string; link?: string; sentiment: "favorabil"|"neutru"|"defavorabil"; canal: "presa"|"tv"|"radio"; data?: string };

export default function ListaMonitorizarePage() {
  const { db } = initFirebase();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"card"|"table">("card");
  const [search, setSearch] = useState("");
  const [canal, setCanal] = useState<string>("");
  const [sentiment, setSentiment] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { judetId, structuraId } = getTenantContext();
        const snap = await getDocs(collection(doc(db, `Judete/${judetId}/Structuri/${structuraId}`), "MonitorizarePresa"));
        setItems(snap.docs.map((d)=> ({ id: d.id, ...(d.data() as any) })) as Item[]);
      } finally {
        setLoading(false);
      }
    })();
  }, [db]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items
      .filter((x) => !canal || x.canal === canal)
      .filter((x) => !sentiment || x.sentiment === sentiment)
      .filter((x) => !s || [x.titlu, x.continut, x.link].filter(Boolean).map(String).some((v)=>v.toLowerCase().includes(s)));
  }, [items, search, canal, sentiment]);

  const getSentimentBadge = (sentiment: Item["sentiment"]) => {
    const configs = {
      favorabil: { icon: <ThumbsUp size={12} />, class: "bg-green-100 text-green-700 border border-green-200" },
      defavorabil: { icon: <ThumbsDown size={12} />, class: "bg-red-100 text-red-700 border border-red-200" },
      neutru: { icon: <Minus size={12} />, class: "bg-gray-100 text-gray-700 border border-gray-200" },
    };
    const config = configs[sentiment];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${config.class}`}>
        {config.icon}
        {labelSentiment(sentiment)}
      </span>
    );
  };

  const getCanalBadge = (canal: Item["canal"]) => {
    const configs = {
      presa: { icon: <Monitor size={12} />, class: "bg-blue-100 text-blue-700 border border-blue-200" },
      tv: { icon: <Tv size={12} />, class: "bg-purple-100 text-purple-700 border border-purple-200" },
      radio: { icon: <Radio size={12} />, class: "bg-orange-100 text-orange-700 border border-orange-200" },
    };
    const config = configs[canal];
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${config.class}`}>
        {config.icon}
        {labelCanal(canal)}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header modern */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-gray-900 inline-flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <Newspaper size={18} className="text-white" />
            </div>
            Monitorizare presă
          </div>
          <div className="text-sm text-gray-600 mt-1">Materiale monitorizate din presă ({filtered.length} afișate din {items.length})</div>
        </div>
        <div className="flex items-center gap-3">
          <Link 
            href="/monitorizare/creaza" 
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
          >
            <Plus size={16} />
            Adaugă material
          </Link>
          <div className="inline-flex rounded-lg overflow-hidden border border-gray-200 shadow-sm">
            <button 
              className={`px-3 py-2 flex items-center gap-2 text-sm font-medium transition-colors ${
                view==='card' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`} 
              onClick={()=>setView('card')}
            >
              <Grid2X2 size={14} />
              Carduri
            </button>
            <button 
              className={`px-3 py-2 border-l border-gray-200 flex items-center gap-2 text-sm font-medium transition-colors ${
                view==='table' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
              }`} 
              onClick={()=>setView('table')}
            >
              <Rows2 size={14} />
              Tabel
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            value={search} 
            onChange={(e)=>setSearch(e.target.value)} 
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none" 
            placeholder="Caută titlu, conținut sau link..." 
          />
        </div>
        <select 
          value={canal} 
          onChange={(e)=>setCanal(e.target.value)} 
          className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none bg-white"
        >
          <option value="">Toate canalele</option>
          <option value="presa">Presa scrisă / Online</option>
          <option value="tv">Televiziune</option>
          <option value="radio">Radio</option>
        </select>
        <select 
          value={sentiment} 
          onChange={(e)=>setSentiment(e.target.value)} 
          className="border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none bg-white"
        >
          <option value="">Toate sentimentele</option>
          <option value="favorabil">Favorabil</option>
          <option value="neutru">Neutru</option>
          <option value="defavorabil">Defavorabil</option>
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-16 h-5 bg-gray-200 animate-pulse rounded" />
                <div className="w-20 h-5 bg-gray-200 animate-pulse rounded" />
                <div className="w-18 h-5 bg-gray-200 animate-pulse rounded" />
              </div>
              <div className="h-5 w-60 bg-gray-200 animate-pulse mb-3 rounded" />
              <div className="h-20 w-full bg-gray-200 animate-pulse mb-3 rounded" />
              <div className="h-4 w-32 bg-gray-200 animate-pulse rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Newspaper size={24} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Niciun material găsit</h3>
          <p className="text-gray-500 mb-6">
            {search || canal || sentiment ? "Încercați să modificați criteriile de căutare." : "Începe prin a adăuga primul material monitorizat."}
          </p>
          {!(search || canal || sentiment) && (
            <Link 
              href="/monitorizare/creaza" 
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} />
              Primul material
            </Link>
          )}
        </div>
      ) : (
        view === 'card' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((x) => (
              <div key={x.id} className="group rounded-2xl border border-gray-200 bg-white shadow-sm p-6 hover:shadow-xl hover:border-gray-300 transition-all duration-200">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  {x.data && (
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <Calendar size={12} />
                      {x.data}
                    </div>
                  )}
                  {getCanalBadge(x.canal)}
                  {getSentimentBadge(x.sentiment)}
                </div>
                <div className="font-semibold text-lg text-gray-900 mb-2 line-clamp-2">{x.titlu}</div>
                {x.continut && (
                  <div className="text-sm text-gray-700 mb-3 line-clamp-3">{x.continut}</div>
                )}
                {x.link && (
                  <a 
                    href={x.link} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    <ExternalLink size={14} />
                    Deschide materialul
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                <tr>
                  <th className="p-4 text-left font-semibold text-gray-700">Data</th>
                  <th className="p-4 text-left font-semibold text-gray-700">Material</th>
                  <th className="p-4 text-left font-semibold text-gray-700">Canal</th>
                  <th className="p-4 text-left font-semibold text-gray-700">Sentiment</th>
                  <th className="p-4 text-left font-semibold text-gray-700">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((x, idx) => (
                  <tr key={x.id} className={`hover:bg-blue-50/30 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                    <td className="p-4 text-sm text-gray-700">
                      {x.data ? (
                        <div className="flex items-center gap-1">
                          <Calendar size={12} className="text-gray-400" />
                          {x.data}
                        </div>
                      ) : '—'}
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-gray-900">{x.titlu}</div>
                      {x.continut && <div className="text-sm text-gray-600 mt-1 line-clamp-2">{x.continut}</div>}
                    </td>
                    <td className="p-4">{getCanalBadge(x.canal)}</td>
                    <td className="p-4">{getSentimentBadge(x.sentiment)}</td>
                    <td className="p-4">
                      {x.link ? (
                        <a 
                          href={x.link} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm"
                        >
                          <ExternalLink size={12} />
                          Deschide
                        </a>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

function labelCanal(c: Item["canal"]) {
  switch (c) {
    case "presa": return "Presa scrisă / Agenții / Online";
    case "tv": return "Televiziune";
    case "radio": return "Radio";
    default: return c;
  }
}
function labelSentiment(s: Item["sentiment"]) {
  switch (s) {
    case "favorabil": return "Favorabil";
    case "neutru": return "Neutru";
    case "defavorabil": return "Defavorabil";
    default: return s;
  }
}


