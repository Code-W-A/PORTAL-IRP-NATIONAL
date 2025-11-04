"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs } from "firebase/firestore";
import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";
import Link from "next/link";
import { Users, Search, Filter, UserCheck, UserX, Building2, Mail, IdCard, RotateCcw } from "lucide-react";

type Journalist = { id: string; nume: string; email?: string; legit?: string; redactie?: string; lastAcreditareYear?: number };

export default function JurnalistiPage() {
  const { db } = initFirebase();
  const [items, setItems] = useState<Journalist[]>([]);
  const [loading, setLoading] = useState(true);
  const currentYear = new Date().getFullYear();
  const [search, setSearch] = useState("");
  const [onlyCurrent, setOnlyCurrent] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { judetId, structuraId } = getTenantContext();
        const snap = await getDocs(collection(doc(db, `Judete/${judetId}/Structuri/${structuraId}`), "Jurnalisti"));
        setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Journalist[]);
      } finally {
        setLoading(false);
      }
    })();
  }, [db]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items
      .filter((x) => (onlyCurrent ? x.lastAcreditareYear === currentYear : true))
      .filter((x) => !s || [x.nume, x.email, x.redactie, x.legit].filter(Boolean).map(String).some((v) => v.toLowerCase().includes(s)));
  }, [items, search, onlyCurrent, currentYear]);

  return (
    <div className="space-y-6">
      {/* Header modern */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-gray-900 inline-flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Users size={18} className="text-white" />
            </div>
            Jurnaliști acreditați
          </div>
          <div className="text-sm text-gray-600 mt-1">Gestionează baza de date cu jurnaliștii ({filtered.length} afișați din {items.length})</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            value={search} 
            onChange={(e)=>setSearch(e.target.value)} 
            placeholder="Caută nume, email sau redacție..." 
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none" 
          />
        </div>
        <label className="inline-flex items-center gap-3 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
          <input 
            type="checkbox" 
            checked={onlyCurrent} 
            onChange={(e)=>setOnlyCurrent(e.target.checked)} 
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Filter size={14} />
            Doar acreditați anul curent
          </div>
        </label>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gray-200 animate-pulse rounded-full" />
                <div className="flex-1">
                  <div className="h-4 w-32 bg-gray-200 animate-pulse mb-2 rounded" />
                  <div className="h-3 w-24 bg-gray-200 animate-pulse rounded" />
                </div>
                <div className="w-16 h-6 bg-gray-200 animate-pulse rounded" />
              </div>
              <div className="space-y-2 mb-4">
                <div className="h-5 w-40 bg-gray-200 animate-pulse rounded" />
                <div className="h-4 w-32 bg-gray-200 animate-pulse rounded" />
                <div className="h-4 w-36 bg-gray-200 animate-pulse rounded" />
              </div>
              <div className="h-9 w-32 bg-gray-200 animate-pulse rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users size={24} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Niciun jurnalist găsit</h3>
          <p className="text-gray-500 mb-6">
            {search || onlyCurrent ? "Încercați să modificați criteriile de căutare." : "Începe prin a crea prima acreditare."}
          </p>
          {!(search || onlyCurrent) && (
            <Link 
              href="/acreditari/creaza" 
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Prima acreditare
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((x) => {
            const isCurrent = x.lastAcreditareYear === currentYear;
            return (
              <div key={x.id} className={`group rounded-2xl border shadow-sm p-6 hover:shadow-xl transition-all duration-200 ${
                isCurrent 
                  ? "bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:border-green-300" 
                  : "bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200 hover:border-yellow-300"
              }`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    isCurrent ? "bg-green-200" : "bg-yellow-200"
                  }`}>
                    {isCurrent ? (
                      <UserCheck size={20} className="text-green-700" />
                    ) : (
                      <UserX size={20} className="text-yellow-700" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-lg font-semibold text-gray-900 truncate">{x.nume}</div>
                    <div className="text-xs text-gray-600">{x.redactie || "Redacție nespecificată"}</div>
                  </div>
                  <div className={`px-2 py-1 rounded-lg text-xs font-medium ${
                    isCurrent 
                      ? "bg-green-200 text-green-800" 
                      : "bg-yellow-200 text-yellow-800"
                  }`}>
                    {isCurrent ? "Actual" : x.lastAcreditareYear || "Vechi"}
                  </div>
                </div>
                
                <div className="space-y-2 mb-4">
                  {x.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Mail size={14} className="text-gray-400" />
                      <span className="truncate">{x.email}</span>
                    </div>
                  )}
                  {x.legit && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <IdCard size={14} className="text-gray-400" />
                      <span>Legitimație: {x.legit}</span>
                    </div>
                  )}
                  {x.redactie && (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <Building2 size={14} className="text-gray-400" />
                      <span className="truncate">{x.redactie}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Link 
                    href={`/acreditari/creaza?from=${x.id}`} 
                    className="inline-flex items-center gap-2 flex-1 justify-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
                  >
                    <RotateCcw size={14} />
                    Reacreditează
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


