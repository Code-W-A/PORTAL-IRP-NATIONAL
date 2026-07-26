"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs } from "firebase/firestore";
import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";
import { yearFromDateLabel } from "@/lib/acreditari";
import { acrLog, acrLogError } from "@/lib/acreditareClientLog";
import { deleteIssuedAcreditare } from "@/lib/acreditariJurnalistDelete";
import Link from "next/link";
import { FileText, Plus, Calendar, IdCard, Building2, Download, Pencil, Trash2, Loader2, Printer, Search, Filter, LayoutGrid, Table, ChevronUp, ChevronDown } from "lucide-react";

type Acr = {
  id: string;
  numar: string;
  data: string;
  nume: string;
  legit: string;
  redactie: string;
  email?: string;
  telefon?: string;
  source?: { cerereId?: string };
};

export default function ListaAcreditariPage() {
  const { db, auth } = initFirebase();
  const [items, setItems] = useState<Acr[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [view, setView] = useState<"cards" | "table">("cards");
  const [search, setSearch] = useState("");
  const [onlyCurrent, setOnlyCurrent] = useState(false);
  const currentYear = new Date().getFullYear();
  const [sortBy, setSortBy] = useState<"numar" | "data" | "nume" | "legit" | "redactie">("data");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  async function load() {
      try {
        setLoading(true);
        const { judetId, structuraId } = getTenantContext();
        const snap = await getDocs(collection(doc(db, `Judete/${judetId}/Structuri/${structuraId}`), "Acreditari"));
        setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Acr[]);
      } finally {
        setLoading(false);
      }
  }

  useEffect(() => {
    load();
  }, [db]);

  function getViewStorageKey() {
    try {
      const { judetId, structuraId } = getTenantContext();
      return `acreditari:lista:view:${String(judetId || "")}:${String(structuraId || "")}`;
    } catch {
      return "acreditari:lista:view";
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const v = localStorage.getItem(getViewStorageKey());
      if (v === "cards" || v === "table") setView(v);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(getViewStorageKey(), view);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  function yearFromData(v?: string): number | null {
    return yearFromDateLabel(v);
  }

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items
      .filter((x) => (onlyCurrent ? yearFromData(x.data) === currentYear : true))
      .filter((x) => !s || [x.nume, x.redactie, x.legit, x.numar, x.data].filter(Boolean).map(String).some((v) => v.toLowerCase().includes(s)));
  }, [items, search, onlyCurrent, currentYear]);

  function parseNumar(v?: string): number | null {
    const s = String(v || "").trim();
    if (!s) return null;
    if (/^\d+$/.test(s)) return Number(s);
    const n = Number(s.replace(/\D+/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function parseDateToNumber(v?: string): number | null {
    const s = String(v || "").trim();
    if (!s) return null;
    const m1 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (m1) return Number(`${m1[3]}${m1[2]}${m1[1]}`);
    const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m2) return Number(`${m2[1]}${m2[2]}${m2[3]}`);
    return null;
  }

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const list = [...filtered];
    list.sort((a, b) => {
      let av: any = "";
      let bv: any = "";
      if (sortBy === "numar") {
        av = parseNumar(a.numar);
        bv = parseNumar(b.numar);
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return (av - bv) * dir;
      }
      if (sortBy === "data") {
        av = parseDateToNumber(a.data);
        bv = parseDateToNumber(b.data);
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return (av - bv) * dir;
      }
      if (sortBy === "nume") {
        av = String(a.nume || "").toLowerCase();
        bv = String(b.nume || "").toLowerCase();
      } else if (sortBy === "legit") {
        av = String(a.legit || "").toLowerCase();
        bv = String(b.legit || "").toLowerCase();
      } else if (sortBy === "redactie") {
        av = String(a.redactie || "").toLowerCase();
        bv = String(b.redactie || "").toLowerCase();
      }
      if (av === bv) return 0;
      return av > bv ? dir : -dir;
    });
    return list;
  }, [filtered, sortBy, sortDir]);

  async function onDelete(id: string) {
    const ok = confirm("Sigur vrei să ștergi această acreditare? Acțiunea este ireversibilă.");
    if (!ok) {
      acrLog("lista", "delete_cancelled", { acreditareId: id });
      return;
    }
    acrLog("lista", "delete_start", { acreditareId: id });
    try {
      const { judetId, structuraId } = getTenantContext();
      const result = await deleteIssuedAcreditare({ db, judetId, structuraId, acreditareId: id });
      acrLog("lista", "delete_ok", { acreditareId: id, deleted: result.deleted });
      if (!result.deleted) {
        setItems((prev) => prev.filter((x) => x.id !== id));
        return;
      }
      setItems((prev) => prev.filter((x) => x.id !== id));
    } catch (e) {
      acrLogError("lista", "delete_failed", e, { acreditareId: id });
      alert("Nu am putut șterge acreditarea. Încearcă din nou.");
    }
  }

  function safeFileName(name: string): string {
    return String(name || "acreditare")
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^\w.-]+/g, "_")
      .slice(0, 80);
  }

  function openPrintWindow(label: string) {
    const win = window.open("", "_blank");
    if (!win) {
      alert("Pop-up blocat. Permite pop-up-urile pentru a tipări.");
      return null;
    }
    try {
      win.document.title = label;
      win.document.body.innerHTML = `<div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; padding: 16px;">Se pregătește pentru tipărire...</div>`;
    } catch {}
    return win;
  }

  function writePdfPrintHtml(win: Window, objUrl: string, label: string) {
    const safeLabel = String(label || "PDF").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    win.document.open();
    win.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${safeLabel}</title>
    <style>
      html, body { margin: 0; height: 100%; }
      iframe { width: 100%; height: 100%; border: 0; }
    </style>
  </head>
  <body>
    <iframe id="pdf" src="${objUrl}"></iframe>
    <script>
      (function() {
        var f = document.getElementById('pdf');
        var done = false;
        function doPrint() {
          if (done) return;
          done = true;
          try { f.contentWindow && f.contentWindow.focus(); } catch (e) {}
          try { f.contentWindow && f.contentWindow.print(); } catch (e) { window.print(); }
        }
        f.addEventListener('load', function() { setTimeout(doPrint, 50); });
        setTimeout(doPrint, 2000);
      })();
    </script>
  </body>
</html>`);
    win.document.close();
  }

  async function authHeadersForPdf(variant: "signed" | "public"): Promise<HeadersInit> {
    // Signed PDFs require Bearer auth (signature images). Public may work without, but send token when available.
    if (variant === "signed" || auth.currentUser) {
      const token = await auth.currentUser?.getIdToken();
      if (variant === "signed" && !token) throw new Error("missing_auth");
      if (token) return { Authorization: `Bearer ${token}` };
    }
    return {};
  }

  function pdfUrlFor(x: Acr, variant: "signed" | "public") {
    const { judetId, structuraId } = getTenantContext();
    const qs = new URLSearchParams();
    if (variant === "public") qs.set("variant", "public");
    if (judetId) qs.set("judetId", judetId);
    if (structuraId) qs.set("structuraId", structuraId);
    const q = qs.toString();
    return `/api/acreditari/${encodeURIComponent(x.id)}/pdf${q ? `?${q}` : ""}`;
  }

  async function downloadPdf(x: Acr, variant: "signed" | "public") {
    const key = `pdf:${x.id}:${variant}`;
    if (downloadingKey) return;
    setDownloadingKey(key);
    acrLog("lista", "pdf_download_start", { acreditareId: x.id, variant });
    try {
      const headers = await authHeadersForPdf(variant);
      const res = await fetch(pdfUrlFor(x, variant), { method: "GET", headers });
      if (!res.ok) throw new Error("download_failed");
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      const suffix = variant === "public" ? "_fara_semnaturi" : "";
      a.download = `${safeFileName(`acreditare_${x.nume || ""}${suffix}`)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Avoid revoking too early (can cancel downloads in some browsers)
      setTimeout(() => URL.revokeObjectURL(objUrl), 1500);
      acrLog("lista", "pdf_download_ok", { acreditareId: x.id, variant, bytes: blob.size });
    } catch (e) {
      acrLogError("lista", "pdf_download_failed", e, { acreditareId: x.id, variant });
      alert("Nu am putut descărca PDF-ul. Încearcă din nou.");
    } finally {
      setDownloadingKey(null);
    }
  }

  async function printPdf(x: Acr, variant: "signed" | "public") {
    const key = `print:${x.id}:${variant}`;
    if (downloadingKey) return;
    const label = `Acreditare ${x.nume || ""}`.trim() || "Acreditare";
    const win = openPrintWindow(label);
    if (!win) return;
    setDownloadingKey(key);
    try {
      const headers = await authHeadersForPdf(variant);
      const res = await fetch(pdfUrlFor(x, variant), { method: "GET", headers });
      if (!res.ok) throw new Error("print_failed");
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      writePdfPrintHtml(win, objUrl, label);
      // revoke later (after print)
      setTimeout(() => URL.revokeObjectURL(objUrl), 60_000);
    } catch {
      try {
        win.close();
      } catch {}
      alert("Nu am putut deschide pentru tipărire. Încearcă din nou.");
    } finally {
      setDownloadingKey(null);
    }
  }

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
          <div className="text-sm text-gray-600 mt-1">Documentele de acreditare emise ({sorted.length} afișate din {items.length})</div>
        </div>
        <Link 
          href="/acreditari/creaza" 
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
        >
          <Plus size={16} />
          Generează acreditare
        </Link>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Caută nume, nr., legitimație, redacție..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none"
          />
        </div>
        <label className="inline-flex items-center gap-3 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyCurrent}
            onChange={(e) => setOnlyCurrent(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Filter size={14} />
            Doar anul curent
          </div>
        </label>
        <div className="inline-flex items-center rounded-lg border border-gray-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setView("cards")}
            className={`px-3 py-2 text-sm font-medium inline-flex items-center gap-2 ${
              view === "cards" ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
            title="Cards"
          >
            <LayoutGrid size={14} />
            Cards
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            className={`px-3 py-2 text-sm font-medium inline-flex items-center gap-2 ${
              view === "table" ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
            title="Tabel"
          >
            <Table size={14} />
            Tabel
          </button>
        </div>
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
      ) : sorted.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FileText size={24} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nicio acreditare găsită</h3>
          <p className="text-gray-500 mb-6">{search || onlyCurrent ? "Încercați să modificați criteriile de căutare." : "Începe prin a crea prima acreditare pentru jurnaliști."}</p>
          <Link 
            href="/acreditari/creaza" 
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} />
            Generează prima acreditare
          </Link>
        </div>
      ) : (
        <>
          {view === "table" ? (
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr className="text-left text-gray-700">
                      <th
                        className="px-4 py-3 font-semibold cursor-pointer hover:bg-gray-100"
                        onClick={() => {
                          if (sortBy === "numar") setSortDir(sortDir === "asc" ? "desc" : "asc");
                          else { setSortBy("numar"); setSortDir("desc"); }
                        }}
                      >
                        <span className="inline-flex items-center gap-1">
                          Nr.
                          {sortBy === "numar" ? (sortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : null}
                        </span>
                      </th>
                      <th
                        className="px-4 py-3 font-semibold cursor-pointer hover:bg-gray-100"
                        onClick={() => {
                          if (sortBy === "data") setSortDir(sortDir === "asc" ? "desc" : "asc");
                          else { setSortBy("data"); setSortDir("desc"); }
                        }}
                      >
                        <span className="inline-flex items-center gap-1">
                          Data
                          {sortBy === "data" ? (sortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : null}
                        </span>
                      </th>
                      <th
                        className="px-4 py-3 font-semibold cursor-pointer hover:bg-gray-100"
                        onClick={() => {
                          if (sortBy === "nume") setSortDir(sortDir === "asc" ? "desc" : "asc");
                          else { setSortBy("nume"); setSortDir("asc"); }
                        }}
                      >
                        <span className="inline-flex items-center gap-1">
                          Nume
                          {sortBy === "nume" ? (sortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : null}
                        </span>
                      </th>
                      <th
                        className="px-4 py-3 font-semibold cursor-pointer hover:bg-gray-100"
                        onClick={() => {
                          if (sortBy === "legit") setSortDir(sortDir === "asc" ? "desc" : "asc");
                          else { setSortBy("legit"); setSortDir("asc"); }
                        }}
                      >
                        <span className="inline-flex items-center gap-1">
                          Legitimație
                          {sortBy === "legit" ? (sortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : null}
                        </span>
                      </th>
                      <th
                        className="px-4 py-3 font-semibold cursor-pointer hover:bg-gray-100"
                        onClick={() => {
                          if (sortBy === "redactie") setSortDir(sortDir === "asc" ? "desc" : "asc");
                          else { setSortBy("redactie"); setSortDir("asc"); }
                        }}
                      >
                        <span className="inline-flex items-center gap-1">
                          Redacție
                          {sortBy === "redactie" ? (sortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : null}
                        </span>
                      </th>
                      <th className="px-4 py-3 font-semibold text-right">Acțiuni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sorted.map((x) => (
                      <tr key={x.id} className="hover:bg-gray-50/60">
                        <td className="px-4 py-3 font-medium text-gray-900">{x.numar}</td>
                        <td className="px-4 py-3 text-gray-700">
                          <span className="inline-flex items-center gap-1">
                            <Calendar size={12} className="text-gray-400" />
                            {x.data}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-900">{x.nume}</td>
                        <td className="px-4 py-3 text-gray-700">{x.legit}</td>
                        <td className="px-4 py-3 text-gray-700">{x.redactie}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => downloadPdf(x, "signed")}
                              disabled={!!downloadingKey}
                              className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {downloadingKey === `pdf:${x.id}:signed` ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                              PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => printPdf(x, "signed")}
                              disabled={!!downloadingKey}
                              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {downloadingKey === `print:${x.id}:signed` ? <Loader2 className="animate-spin" size={14} /> : <Printer size={14} />}
                              Print
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadPdf(x, "public")}
                              disabled={!!downloadingKey}
                              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {downloadingKey === `pdf:${x.id}:public` ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                              PDF (fără)
                            </button>
                            <button
                              type="button"
                              onClick={() => printPdf(x, "public")}
                              disabled={!!downloadingKey}
                              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {downloadingKey === `print:${x.id}:public` ? <Loader2 className="animate-spin" size={14} /> : <Printer size={14} />}
                              Print (fără)
                            </button>
                            <Link
                              href={`/acreditari/creaza?edit=${encodeURIComponent(x.id)}`}
                              className="inline-flex items-center justify-center px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-800"
                              title="Editează"
                            >
                              <Pencil size={14} />
                            </Link>
                            <button
                              type="button"
                              onClick={() => onDelete(x.id)}
                              className="inline-flex items-center justify-center px-3 py-2 border border-red-200 text-red-700 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                              title="Șterge"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sorted.map((x) => (
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
                  
                  <div className="flex items-stretch gap-2">
                    <div className="flex-1 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => downloadPdf(x, "signed")}
                        disabled={!!downloadingKey}
                        className="inline-flex items-center gap-2 justify-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {downloadingKey === `pdf:${x.id}:signed` ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                        {downloadingKey === `pdf:${x.id}:signed` ? "Se descarcă..." : "PDF (cu semnături)"}
                      </button>
                      <button
                        type="button"
                        onClick={() => printPdf(x, "signed")}
                        disabled={!!downloadingKey}
                        className="inline-flex items-center gap-2 justify-center px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {downloadingKey === `print:${x.id}:signed` ? <Loader2 className="animate-spin" size={14} /> : <Printer size={14} />}
                        {downloadingKey === `print:${x.id}:signed` ? "Se pregătește..." : "Print (cu semnături)"}
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadPdf(x, "public")}
                        disabled={!!downloadingKey}
                        className="inline-flex items-center gap-2 justify-center px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {downloadingKey === `pdf:${x.id}:public` ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                        {downloadingKey === `pdf:${x.id}:public` ? "Se descarcă..." : "PDF (fără semnături)"}
                      </button>
                      <button
                        type="button"
                        onClick={() => printPdf(x, "public")}
                        disabled={!!downloadingKey}
                        className="inline-flex items-center gap-2 justify-center px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {downloadingKey === `print:${x.id}:public` ? <Loader2 className="animate-spin" size={14} /> : <Printer size={14} />}
                        {downloadingKey === `print:${x.id}:public` ? "Se pregătește..." : "Print (fără semnături)"}
                      </button>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Link
                        href={`/acreditari/creaza?edit=${encodeURIComponent(x.id)}`}
                        className="inline-flex items-center justify-center px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-800"
                        title="Editează"
                      >
                        <Pencil size={14} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => onDelete(x.id)}
                        className="inline-flex items-center justify-center px-3 py-2 border border-red-200 text-red-700 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                        title="Șterge"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
