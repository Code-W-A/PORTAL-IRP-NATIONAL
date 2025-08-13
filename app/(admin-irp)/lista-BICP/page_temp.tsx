"use client";
import { useMemo, useState } from "react";
import { useBicpData, type Bicp } from "@/app/(admin-irp)/lista-BICP/hooks/useBicpData";
import { deleteDoc, doc } from "firebase/firestore";
import { initFirebase } from "@/lib/firebase";
import { Grid2X2, Rows2, RefreshCw, Search, FileText, FileDown, Copy as CopyIcon, Trash2, Filter, ChevronUp, ChevronDown, X } from "lucide-react";
import { FiltersDialog } from "./FiltersDialog";

// Funcție pentru badge-uri colorate
function getDocumentBadge(tipDocument: string) {
  const tip = tipDocument || "Document";
  
  let colorClasses = "";
  switch (tip.toLowerCase()) {
    case "comunicat de presă":
      colorClasses = "bg-blue-100 text-blue-700 border border-blue-200";
      break;
    case "buletin informativ":
      colorClasses = "bg-green-100 text-green-700 border border-green-200";
      break;
    case "știre":
      colorClasses = "bg-orange-100 text-orange-700 border border-orange-200";
      break;
    case "declarație de presă":
      colorClasses = "bg-purple-100 text-purple-700 border border-purple-200";
      break;
    case "conferință de presă":
      colorClasses = "bg-red-100 text-red-700 border border-red-200";
      break;
    case "invitație":
      colorClasses = "bg-cyan-100 text-cyan-700 border border-cyan-200";
      break;
    case "interviu":
      colorClasses = "bg-indigo-100 text-indigo-700 border border-indigo-200";
      break;
    case "anunț":
      colorClasses = "bg-yellow-100 text-yellow-700 border border-yellow-200";
      break;
    case "eveniment de presă":
      colorClasses = "bg-pink-100 text-pink-700 border border-pink-200";
      break;
    case "drept la replică":
      colorClasses = "bg-rose-100 text-rose-700 border border-rose-200";
      break;
    default:
      colorClasses = "bg-gray-100 text-gray-700 border border-gray-200";
  }
  
  return (
    <span className={`inline-block px-3 py-1.5 rounded-lg text-sm font-medium ${colorClasses}`}>
      {tip}
    </span>
  );
}

export default function ListaBicpPage() {
  const { db } = initFirebase();
  const { loading, error, filters, setFilters, items, total, reload } = useBicpData();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<string>(() => localStorage.getItem("bicpViewMode") || "card");
  const [showFilters, setShowFilters] = useState(false);

  const allSelectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);

  async function handleDeleteMany() {
    if (!allSelectedIds.length) return;
    if (!confirm(`Sigur doriți să ștergeți ${allSelectedIds.length} document(e)?`)) return;
    await Promise.all(allSelectedIds.map((id) => deleteDoc(doc(db, "Comunicate", id))));
    setSelected({});
    reload();
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between gap-6 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-xl">
                <FileText size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Lista Documente BI/CP</h1>
                <div className="flex items-center gap-4 mt-1">
                  <p className="text-lg text-gray-600">Anul {new Date().getFullYear()}</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">Total: <span className="font-semibold text-gray-900">{total}</span> documente</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={reload} 
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-sm transition-colors"
              >
                <RefreshCw size={16} /> Actualizează
              </button>
              <div className="inline-flex rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">
                <button
                  className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                    view === "card" 
                      ? "bg-blue-600 text-white shadow-lg" 
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                  onClick={() => { setView("card"); localStorage.setItem("bicpViewMode", "card"); }}
                >
                  <Grid2X2 size={16} /> Carduri
                </button>
                <button
                  className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-l border-gray-200 transition-colors ${
                    view === "table" 
                      ? "bg-blue-600 text-white shadow-lg" 
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                  onClick={() => { setView("table"); localStorage.setItem("bicpViewMode", "table"); }}
                >
                  <Rows2 size={16} /> Tabel
                </button>
              </div>
              <button 
                onClick={() => setSelectMode((s) => !s)} 
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  selectMode 
                    ? "bg-blue-50 text-blue-700 border-blue-200 shadow-sm" 
                    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-sm"
                }`}
              >
                {selectMode ? "Selecție activă" : "Selectează"}
              </button>
              {selectMode && (
                <button 
                  onClick={handleDeleteMany} 
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 shadow-lg shadow-red-500/25 transition-colors"
                >
                  <Trash2 size={16} /> Șterge ({allSelectedIds.length})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-8">
          <div className="flex gap-4 items-center">
            <div className="relative flex-1">
              <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                placeholder="Caută în titlu, conținut sau nume afișare..."
                className="w-full pl-12 pr-4 py-4 border border-gray-300 rounded-2xl bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm transition-colors text-base"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
              />
            </div>
            <button 
              onClick={() => setShowFilters(true)}
              className="inline-flex items-center gap-2 px-6 py-4 bg-white border border-gray-300 rounded-2xl text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-400 shadow-sm transition-colors whitespace-nowrap"
            >
              <Filter size={18} /> Filtre avansate
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 mb-6">
            <strong>Eroare:</strong> {error}
          </div>
        )}

        {loading ? (
          view === "card" ? <CardSkeletons /> : <TableSkeletons />
        ) : (
          !items.length && (
            <div className="text-center py-20">
              <FileText size={64} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">Nu există documente</h3>
              <p className="text-gray-500">Nu au fost găsite documente care să corespundă criteriilor de căutare.</p>
            </div>
          )
        )}

        {!loading && (
          view === "card" ? (
            <CardView items={items} selectMode={selectMode} selected={selected} setSelected={setSelected} />
          ) : (
            <TableView items={items} selectMode={selectMode} selected={selected} setSelected={setSelected} filters={filters} setFilters={setFilters} />
          )
        )}

        {!loading && (
          <Pagination total={total} page={filters.page} pageSize={filters.pageSize} onChange={(p) => setFilters({ ...filters, page: p })} />
        )}
        
        {/* Filters Dialog */}
        {showFilters && <FiltersDialog filters={filters} setFilters={setFilters} onClose={() => setShowFilters(false)} />}
      </div>
    </div>
  );
}
