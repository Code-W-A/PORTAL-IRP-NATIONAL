"use client";
import { useEffect, useState } from "react";
import { collection, doc, getDocs } from "firebase/firestore";
import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";
import Link from "next/link";
import { FileText, Plus, Calendar, IdCard, Building2, Download } from "lucide-react";

type Acr = { id: string; numar: string; data: string; nume: string; legit: string; redactie: string };

export default function ListaAcreditariPage() {
  const { db } = initFirebase();
  const [items, setItems] = useState<Acr[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const { judetId, structuraId } = getTenantContext();
        const snap = await getDocs(collection(doc(db, `Judete/${judetId}/Structuri/${structuraId}`), "Acreditari"));
        setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Acr[]);
      } finally {
        setLoading(false);
      }
    })();
  }, [db]);

  return (
    <div className="space-y-6">
      {/* Header modern */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-gray-900 inline-flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
              <FileText size={18} className="text-white" />
            </div>
            Lista acreditări
          </div>
          <div className="text-sm text-gray-600 mt-1">Documentele de acreditare emise ({items.length} total)</div>
        </div>
        <Link 
          href="/acreditari/creaza" 
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
        >
          <Plus size={16} />
          Generează acreditare
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gray-200 animate-pulse rounded-xl" />
                <div className="flex-1">
                  <div className="h-4 w-32 bg-gray-200 animate-pulse mb-2 rounded" />
                  <div className="h-3 w-24 bg-gray-200 animate-pulse rounded" />
                </div>
              </div>
              <div className="space-y-2 mb-4">
                <div className="h-5 w-40 bg-gray-200 animate-pulse rounded" />
                <div className="h-4 w-32 bg-gray-200 animate-pulse rounded" />
                <div className="h-4 w-36 bg-gray-200 animate-pulse rounded" />
              </div>
              <div className="h-9 w-20 bg-gray-200 animate-pulse rounded" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText size={24} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nicio acreditare emisă</h3>
          <p className="text-gray-500 mb-6">Începe prin a crea prima acreditare pentru jurnaliști.</p>
          <Link 
            href="/acreditari/creaza" 
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Generează prima acreditare
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((x) => (
            <div key={x.id} className="group rounded-2xl border border-gray-200 bg-white shadow-sm p-6 hover:shadow-xl hover:border-gray-300 transition-all duration-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center">
                  <IdCard size={18} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-medium">Nr. {x.numar}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {x.data}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Acreditare presă</div>
                </div>
              </div>
              
              <div className="space-y-2 mb-4">
                <div className="font-semibold text-lg text-gray-900">{x.nume}</div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <IdCard size={14} className="text-gray-400" />
                  <span>Legitimație: {x.legit}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <Building2 size={14} className="text-gray-400" />
                  <span className="truncate">{x.redactie}</span>
                </div>
              </div>
              
              <div className="flex gap-2">
                <a 
                  className="inline-flex items-center gap-2 flex-1 justify-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm" 
                  target="_blank" 
                  href={`/api/acreditari/${x.id}/pdf`}
                  rel="noreferrer"
                >
                  <Download size={14} />
                  Descarcă PDF
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


