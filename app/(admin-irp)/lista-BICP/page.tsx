"use client";
import { useMemo, useState } from "react";
import { useBicpData, type Bicp } from "@/app/(admin-irp)/lista-BICP/hooks/useBicpData";
import { deleteDoc, doc, collection } from "firebase/firestore";
import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";
import { Grid2X2, Rows2, RefreshCw, Search, FileText, FileDown, Copy as CopyIcon, Trash2, Filter, ChevronUp, ChevronDown, X, Pencil, Printer, Loader2 } from "lucide-react";
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
  const [isPrinting, setIsPrinting] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);

  const allSelectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);

  function openBulkPdfs(variant: "signed" | "public") {
    if (!allSelectedIds.length) return;
    // Deschide fiecare PDF într-un tab nou
    allSelectedIds.forEach((id) => {
      const url = `/api/comunicate/${id}/pdf?variant=${variant === "public" ? "public" : "signed"}`;
      window.open(url, "_blank");
    });
  }

  async function bulkPrintUrls(urls: string[]) {
    if (!urls.length) return;
    setIsPrinting(true);
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    document.body.appendChild(iframe);

    for (const rawUrl of urls) {
      const url = rawUrl.includes("?") ? `${rawUrl}&disposition=inline` : `${rawUrl}?disposition=inline`;
      // eslint-disable-next-line no-await-in-loop
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          try { iframe.onload = null; } catch {}
          resolve();
        };
        iframe.onload = () => {
          try {
            const win = iframe.contentWindow;
            if (!win) return finish();
            const onAfterPrint = () => {
              try { win.removeEventListener("afterprint", onAfterPrint as any); } catch {}
              finish();
            };
            try { win.addEventListener("afterprint", onAfterPrint as any); } catch {}
            // Așteaptă o clipă ca PDF-ul să se așeze înainte de print
            setTimeout(() => {
              try { win.focus(); } catch {}
              try { win.print(); } catch { onAfterPrint(); }
              // Fallback dacă afterprint nu se declanșează
              setTimeout(onAfterPrint, 4000);
            }, 350);
          } catch {
            finish();
          }
        };
        iframe.src = url;
      });
      // mică pauză între printuri
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 200));
    }

    try { document.body.removeChild(iframe); } catch {}
    setIsPrinting(false);
  }

  async function startBulkPrint(variant: "signed" | "public") {
    if (!allSelectedIds.length || isPrinting) return;
    setIsPrinting(true);
    try {
      const res = await fetch(`/api/comunicate/bulk-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: allSelectedIds, variant }),
      });
      if (!res.ok) throw new Error("bulk pdf failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.opacity = "0";
      iframe.style.pointerEvents = "none";
      document.body.appendChild(iframe);
      await new Promise<void>((resolve) => {
        iframe.onload = () => resolve();
        iframe.src = url;
      });
      const win = iframe.contentWindow;
      const cleanup = () => {
        try { document.body.removeChild(iframe); } catch {}
        try { URL.revokeObjectURL(url); } catch {}
      };
      const afterPrintPromise = new Promise<void>((resolve) => {
        const handler = () => {
          try { win?.removeEventListener("afterprint", handler as any); } catch {}
          try { window.removeEventListener("focus", onFocus, { capture: true } as any); } catch {}
          resolve();
        };
        const onFocus = () => {
          // După închiderea dialogului de print, focus revine la fereastră
          handler();
        };
        try { win?.addEventListener("afterprint", handler as any); } catch {}
        try { window.addEventListener("focus", onFocus, { once: true, capture: true } as any); } catch {}
        // Fallback maxim 20s
        setTimeout(handler, 20000);
      });
      try { win?.focus(); } catch {}
      try { win?.print(); } catch {}
      await afterPrintPromise;
      cleanup();
    } catch (e) {
      alert("Eroare la generarea PDF-ului combinat");
    }
    setIsPrinting(false);
  }

  async function printSingle(id: string, variant: "signed" | "public" = "signed") {
    if (isPrinting) return;
    setIsPrinting(true);
    setPrintingId(id);
    try {
      const url = `/api/comunicate/${id}/pdf?variant=${variant}&disposition=inline`;
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.opacity = "0";
      iframe.style.pointerEvents = "none";
      document.body.appendChild(iframe);
      await new Promise<void>((resolve) => { iframe.onload = () => resolve(); iframe.src = url; });
      const win = iframe.contentWindow;
      const afterPrintPromise = new Promise<void>((resolve) => {
        const handler = () => {
          try { win?.removeEventListener("afterprint", handler as any); } catch {}
          try { window.removeEventListener("focus", onFocus, { capture: true } as any); } catch {}
          resolve();
        };
        const onFocus = () => { handler(); };
        try { win?.addEventListener("afterprint", handler as any); } catch {}
        try { window.addEventListener("focus", onFocus, { once: true, capture: true } as any); } catch {}
        setTimeout(handler, 20000);
      });
      try { win?.focus(); } catch {}
      try { win?.print(); } catch {}
      await afterPrintPromise;
      try { document.body.removeChild(iframe); } catch {}
    } catch (e) {
      alert("Eroare la tipărirea documentului");
    }
    setIsPrinting(false);
    setPrintingId(null);
  }

  async function handleDeleteMany() {
    if (!allSelectedIds.length) return;
    if (!confirm(`Sigur doriți să ștergeți ${allSelectedIds.length} document(e)?`)) return;
    try {
      const { judetId, structuraId } = getTenantContext();
      const collectionPath = collection(doc(db, `Judete/${judetId}/Structuri/${structuraId}`), "Comunicate");
      await Promise.all(allSelectedIds.map((id) => deleteDoc(doc(collectionPath, id))));
      setSelected({});
      reload();
    } catch (error) {
      console.error("Eroare la ștergerea documentelor:", error);
      alert("Eroare la ștergerea documentelor. Verificați consola pentru detalii.");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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
            <div className="flex items-center gap-3 flex-wrap w-full md:w-auto">
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
                <div className="flex items-center gap-2 flex-wrap">
                  <button 
                    onClick={() => openBulkPdfs("signed")} 
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg transition-colors"
                    title="Descarcă PDF cu semnături pentru selecție"
                  >
                    <FileDown size={16} /> PDF semnate ({allSelectedIds.length})
                  </button>
                  <button 
                    onClick={() => openBulkPdfs("public")} 
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg transition-colors"
                    title="Descarcă PDF fără semnături pentru selecție"
                  >
                    <FileText size={16} /> PDF fără semnături ({allSelectedIds.length})
                  </button>
                  <button 
                    onClick={() => startBulkPrint("signed")} 
                    disabled={!allSelectedIds.length || isPrinting}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg transition-colors ${(!allSelectedIds.length || isPrinting) ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}
                    title="Printează PDF cu semnături pentru selecție"
                  >
                    <FileDown size={16} /> {isPrinting ? "Se tipărește..." : "Printează semnate"}
                  </button>
                  <button 
                    onClick={() => startBulkPrint("public")} 
                    disabled={!allSelectedIds.length || isPrinting}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg transition-colors ${(!allSelectedIds.length || isPrinting) ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-teal-600 text-white hover:bg-teal-700"}`}
                    title="Printează PDF fără semnături pentru selecție"
                  >
                    <FileText size={16} /> {isPrinting ? "Se tipărește..." : "Printează publice"}
                  </button>
                  <button 
                    onClick={handleDeleteMany} 
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 shadow-lg shadow-red-500/25 transition-colors"
                  >
                    <Trash2 size={16} /> Șterge ({allSelectedIds.length})
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
            <div className="relative flex-1 w-full">
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
              className="inline-flex items-center gap-2 px-6 py-4 bg-white border border-gray-300 rounded-2xl text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-400 shadow-sm transition-colors whitespace-nowrap w-full md:w-auto justify-center"
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
            <CardView items={items} selectMode={selectMode} selected={selected} setSelected={setSelected} printSingle={printSingle} isPrinting={isPrinting} printingId={printingId} />
          ) : (
            <TableView items={items} selectMode={selectMode} selected={selected} setSelected={setSelected} filters={filters} setFilters={setFilters} printSingle={printSingle} isPrinting={isPrinting} printingId={printingId} />
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

function CardView({ items, selectMode, selected, setSelected, printSingle, isPrinting, printingId }: { items: Bicp[]; selectMode: boolean; selected: Record<string, boolean>; setSelected: (m: Record<string, boolean>) => void; printSingle: (id: string, variant?: "signed" | "public") => void; isPrinting: boolean; printingId: string | null }) {
  if (!items.length) return (
    <div className="text-center py-12">
      <FileText size={48} className="mx-auto text-gray-300 mb-3" />
      <p className="text-gray-500">Nu există documente care să corespundă criteriilor.</p>
    </div>
  );
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {items.map((x) => {
        const label = x.numeAfisare || `${x.numarComunicat ?? x.numar} - ${x.nume || x.tip} - ${x.titlu}`;
        const isSelected = !!selected[x.id];
        return (
          <div key={x.id} className={`group relative bg-white rounded-2xl border border-gray-200 p-6 hover:border-gray-300 hover:shadow-xl transition-all duration-200 ${isSelected ? "ring-2 ring-blue-500 border-blue-300 shadow-lg" : ""}`}>
            {selectMode && (
              <div className="absolute top-4 right-4">
                <input 
                  type="checkbox" 
                  checked={isSelected} 
                  onChange={(e) => setSelected({ ...selected, [x.id]: e.target.checked })}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
              </div>
            )}
            
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText size={18} className="text-blue-600" />
                {getDocumentBadge(x.nume || x.tip || "")}
              </div>
              <h3 className="font-semibold text-gray-900 line-clamp-2 leading-5">
                {x.titlu || "Fără titlu"}
              </h3>
            </div>
            
            <div className="space-y-2 mb-5">
              <div className="flex items-center text-sm text-gray-600">
                <span className="font-medium text-gray-700">Nr:</span>
                <span className="ml-1 text-gray-900 font-bold text-lg">{x.numarComunicat ?? x.numar}</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <span className="font-medium text-gray-700">Data:</span>
                <span className="ml-1 text-gray-900">{typeof x.data === "string" ? x.data : "—"}</span>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <a 
                className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm" 
                href={`/api/comunicate/${x.id}/pdf?variant=signed`} 
                target="_blank" 
                rel="noreferrer"
                title="PDF cu semnături"
              >
                <FileDown size={14}/> PDF cu semnături
              </a>
              <a 
                className="inline-flex items-center gap-2 px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm" 
                href={`/api/comunicate/${x.id}/pdf?variant=public`} 
                target="_blank" 
                rel="noreferrer"
                title="PDF fără semnături"
              >
                <FileText size={14}/> PDF fără semnături
              </a>
              <button
                onClick={() => printSingle(x.id, "signed")}
                disabled={isPrinting}
                className={`inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-lg transition-colors shadow-sm ${isPrinting ? "border-gray-200 text-gray-500 cursor-not-allowed bg-gray-50" : "border-gray-300 hover:bg-gray-50"}`}
                title="Printează document"
              >
                {printingId === x.id ? <Loader2 className="animate-spin" size={14}/> : <Printer size={14}/>} {printingId === x.id ? "Se pregătește..." : "Printează"}
              </button>
              <a
                className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                href={`/editeaza-BICP/${x.id}`}
                title="Editează document"
              >
                <Pencil size={14}/> Editează
              </a>
              <CopyButton label="Titlu" value={x.titlu} />
              <CopyButton label="Conținut" value={x.comunicat || ""} />
              {!selectMode && (<DeleteButton id={x.id} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CardSkeletons() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-5 h-5 rounded bg-gray-200 animate-pulse" />
            <div className="h-6 w-32 rounded bg-gray-200 animate-pulse" />
          </div>
          <div className="space-y-2 mb-5">
            <div className="h-4 w-48 rounded bg-gray-200 animate-pulse" />
            <div className="h-4 w-64 rounded bg-gray-200 animate-pulse" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-20 rounded-lg bg-gray-200 animate-pulse" />
            <div className="h-9 w-20 rounded-lg bg-gray-200 animate-pulse" />
            <div className="h-9 w-24 rounded-lg bg-gray-200 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TableSkeletons() {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
            <tr>
              <th className="p-4 text-left font-semibold text-gray-700 w-12" />
              <th className="p-4 text-left font-semibold text-gray-700 w-24">Număr</th>
              <th className="p-4 text-left font-semibold text-gray-700 w-80">Document</th>
              <th className="p-4 text-left font-semibold text-gray-700 w-28">Data</th>
              <th className="p-4 text-left font-semibold text-gray-700 w-40">Tip Document</th>
              <th className="p-4 text-left font-semibold text-gray-700">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-t">
                <td className="p-4" />
                <td className="p-4">
                  <div className="h-4 w-10 rounded bg-gray-200 animate-pulse" />
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-200 animate-pulse" />
                    <div className="flex-1 min-w-0">
                      <div className="h-4 w-56 rounded bg-gray-200 animate-pulse mb-2" />
                      <div className="h-4 w-28 rounded bg-gray-200 animate-pulse" />
                    </div>
                  </div>
                </td>
                <td className="p-4">
                  <div className="h-4 w-20 rounded bg-gray-200 animate-pulse" />
                </td>
                <td className="p-4">
                  <div className="h-6 w-36 rounded-lg bg-gray-200 animate-pulse" />
                </td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <div className="h-7 w-16 rounded-lg bg-gray-200 animate-pulse" />
                    <div className="h-7 w-16 rounded-lg bg-gray-200 animate-pulse" />
                    <div className="h-7 w-20 rounded-lg bg-gray-200 animate-pulse" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TableView({ items, selectMode, selected, setSelected, filters, setFilters, printSingle, isPrinting, printingId }: { items: Bicp[]; selectMode: boolean; selected: Record<string, boolean>; setSelected: (m: Record<string, boolean>) => void; filters: any; setFilters: (f: any) => void; printSingle: (id: string, variant?: "signed" | "public") => void; isPrinting: boolean; printingId: string | null }) {
  // if (!items.length) return (
  //   <div className="text-center py-12">
  //     <FileText size={48} className="mx-auto text-gray-300 mb-3" />
  //     <p className="text-gray-500">Nu există documente care să corespundă criteriilor.</p>
  //   </div>
  // );
  
  const currentPageIds = items.map((x) => x.id);
  const allPageSelected = currentPageIds.every((id) => selected[id]);
  const togglePage = (val: boolean) => {
    const m = { ...selected };
    currentPageIds.forEach((id) => (m[id] = val));
    setSelected(m);
  };

  const handleSort = (column: string) => {
    if (filters.sortBy === column) {
      // Toggle direction
      setFilters({ ...filters, sortDir: filters.sortDir === "asc" ? "desc" : "asc", page: 1 });
    } else {
      // New column, default to desc
      setFilters({ ...filters, sortBy: column, sortDir: "desc", page: 1 });
    }
  };

  const SortableHeader = ({ column, children, className }: { column: string; children: React.ReactNode; className?: string }) => (
    <th 
      className={`p-4 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors ${className || ""}`}
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-2">
        {children}
        {filters.sortBy === column && (
          filters.sortDir === "asc" ? <ChevronUp size={16} /> : <ChevronDown size={16} />
        )}
      </div>
    </th>
  );
  
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
            <tr>
              <th className="p-4 text-left font-semibold text-gray-700 w-12">
                {selectMode && (
                  <input 
                    type="checkbox" 
                    checked={allPageSelected} 
                    onChange={(e) => togglePage(e.target.checked)}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                )}
              </th>
              <SortableHeader column="numarComunicat" className="w-24">Număr</SortableHeader>
              <SortableHeader column="titlu" className="w-80">Document</SortableHeader>
              <SortableHeader column="data" className="w-28">Data</SortableHeader>
              <SortableHeader column="nume" className="w-40">Tip Document</SortableHeader>
              <th className="p-4 text-left font-semibold text-gray-700">Acțiuni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((x, idx) => {
              const label = x.numeAfisare || `${x.numarComunicat ?? x.numar} - ${x.nume || x.tip} - ${x.titlu}`;
              const isSelected = !!selected[x.id];
              return (
                <tr key={x.id} className={`group hover:bg-blue-50/30 transition-colors ${isSelected ? "bg-blue-50" : idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                  <td className="p-4 w-12">
                    {selectMode && (
                      <input 
                        type="checkbox" 
                        checked={isSelected} 
                        onChange={(e) => setSelected({ ...selected, [x.id]: e.target.checked })}
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    )}
                  </td>
                  <td className="p-4 w-24 font-bold text-lg text-gray-900">{x.numarComunicat ?? x.numar}</td>
                  <td className="p-4 w-80">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center">
                          <FileText size={18} className="text-blue-600" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">{x.titlu || "Fără titlu"}</p>
                        <p className="text-sm text-gray-500 truncate">
                          {getDocumentBadge(x.nume || x.tip || "")}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 w-28 text-gray-700">{typeof x.data === "string" ? x.data : "—"}</td>
                  <td className="p-4 w-40">{getDocumentBadge(x.nume || x.tip || "")}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1.5">
                      <a 
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm" 
                        href={`/api/comunicate/${x.id}/pdf?variant=signed`} 
                        target="_blank" 
                        rel="noreferrer"
                        title="PDF cu semnături"
                      >
                        <FileDown size={12}/> PDF semnat
                      </a>
                      <a 
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm" 
                        href={`/api/comunicate/${x.id}/pdf?variant=public`} 
                        target="_blank" 
                        rel="noreferrer"
                        title="PDF fără semnături"
                      >
                        <FileText size={12}/> PDF fără semnături
                      </a>
                      <button 
                        onClick={() => printSingle(x.id, "signed")} 
                        disabled={isPrinting}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border rounded-lg transition-colors shadow-sm ${isPrinting ? "border-gray-200 text-gray-500 cursor-not-allowed bg-gray-50" : "border-gray-300 hover:bg-gray-50"}`} 
                        title="Printează"
                      >
                        {printingId === x.id ? <Loader2 className="animate-spin" size={12}/> : <Printer size={12}/>} {printingId === x.id ? "Se pregătește..." : "Printează"}
                      </button>
                      <a 
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm" 
                        href={`/editeaza-BICP/${x.id}`}
                        title="Editează"
                      >
                        <Pencil size={12}/> Editează
                      </a>
                      <CopyButton label="Titlu" value={x.titlu} small />
                      <CopyButton label="Conținut" value={x.comunicat || ""} small />
                      {!selectMode && <DeleteButton id={x.id} small />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CopyButton({ label, value, small }: { label: string; value: string; small?: boolean }) {
  const [copied, setCopied] = useState(false);
  
  async function copy() {
    try {
      if (!value || value.trim() === "") {
        alert(`Nu există conținut de copiat pentru ${label}`);
        return;
      }

      const textToCopy = value.trim();
      
      // Încearcă să folosească Clipboard API modern
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        console.log(`✅ Copiat în clipboard (${label}):`, textToCopy.substring(0, 50) + (textToCopy.length > 50 ? '...' : ''));
        return;
      }

      // Fallback pentru browsere mai vechi sau HTTP (non-HTTPS)
      const textArea = document.createElement('textarea');
      textArea.value = textToCopy;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '-9999px';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (successful) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        console.log(`✅ Copiat cu fallback (${label}):`, textToCopy.substring(0, 50) + (textToCopy.length > 50 ? '...' : ''));
      } else {
        throw new Error("Clipboard copy failed");
      }
    } catch (error) {
      console.error("❌ Eroare la copiere:", error);
      alert(`Eroare la copiere pentru ${label}. Verificați dacă site-ul rulează pe HTTPS sau încercați din nou.`);
    }
  }
  
  return (
    <button 
      onClick={copy} 
      className={`inline-flex items-center gap-1.5 rounded-lg border transition-colors ${
        copied 
          ? "border-green-200 bg-green-50 text-green-700" 
          : "border-gray-200 hover:bg-gray-50 hover:border-gray-300"
      } ${small ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"}`}
    >
      <CopyIcon size={small ? 12 : 14} /> {copied ? "Copiat!" : label}
    </button>
  );
}

function DeleteButton({ id, small }: { id: string; small?: boolean }) {
  const { db } = initFirebase();
  async function del() {
    if (!confirm("Sigur doriți să ștergeți acest document?")) return;
    try {
      const { judetId, structuraId } = getTenantContext();
      const docRef = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Comunicate/${id}`);
      await deleteDoc(docRef);
      console.log(`Document ${id} șters cu succes din Firebase`);
      location.reload();
    } catch (error) {
      console.error("Eroare la ștergerea documentului:", error);
      alert("Eroare la ștergerea documentului. Verificați consola pentru detalii.");
    }
  }
  return (
    <button 
      onClick={del} 
      className={`inline-flex items-center gap-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors ${small ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"}`}
    >
      <Trash2 size={small ? 12 : 14} /> {small ? "Șterge" : "Șterge Document"}
    </button>
  );
}

function Pagination({ total, page, pageSize, onChange }: { total: number; page: number; pageSize: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const btn = (p: number, label?: string) => (
    <button 
      key={p + (label || "")} 
      onClick={() => onChange(p)} 
      className={`px-3 py-2 rounded-lg border transition-colors ${
        p === page 
          ? "bg-blue-600 text-white border-blue-600 shadow-sm" 
          : "border-gray-200 hover:bg-gray-50 hover:border-gray-300"
      }`}
    >
      {label || p}
    </button>
  );
  const items: React.ReactNode[] = [];
  const range = (s: number, e: number) => {
    for (let i = s; i <= e; i++) items.push(btn(i));
  };
  if (pages <= 7) {
    range(1, pages);
  } else {
    items.push(btn(1));
    if (page > 4) items.push(<span key="l" className="px-2 text-gray-400">…</span>);
    const start = Math.max(2, page - 1);
    const end = Math.min(pages - 1, page + 1);
    range(start, end);
    if (page < pages - 3) items.push(<span key="r" className="px-2 text-gray-400">…</span>);
    items.push(btn(pages));
  }
  return (
    <div className="flex gap-2 items-center flex-wrap justify-center mt-6">
      {page > 1 && btn(page - 1, "‹")}
      {items}
      {page < pages && btn(page + 1, "›")}
      <span className="text-sm text-gray-600 ml-4 px-3 py-2 bg-gray-50 rounded-lg">
        Pagina {page} din {pages} • {total} documente
      </span>
    </div>
  );
}
