"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, Search, Filter, UserCheck, UserX, Building2, Mail, IdCard, RotateCcw, Pencil, Trash2, Save, X, LayoutGrid, Table, ChevronLeft, ChevronRight, Phone, Upload, Loader2, Download } from "lucide-react";

type Journalist = { id: string; nume: string; email?: string; telefon?: string; legit?: string; redactie?: string; adresaRedactie?: string; lastAcreditareYear?: number; lastAcreditareNumar?: string };
type ImportRow = { redactie: string; adresaRedactie: string; numeJurnalist: string; telefon: string; email: string; legit: string };

export default function JurnalistiPage() {
  const { db } = initFirebase();
  const router = useRouter();
  const [items, setItems] = useState<Journalist[]>([]);
  const [loading, setLoading] = useState(true);
  const currentYear = new Date().getFullYear();
  const [search, setSearch] = useState("");
  const [onlyCurrent, setOnlyCurrent] = useState(false);
  const [view, setView] = useState<"cards" | "table">("cards");
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState<number>(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Pick<Journalist, "nume" | "email" | "telefon" | "legit" | "redactie">>({
    nume: "",
    email: "",
    telefon: "",
    legit: "",
    redactie: "",
  });
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [exportScope, setExportScope] = useState<"all" | "year">("year");
  const [exportYear, setExportYear] = useState<number>(currentYear);

  function getViewStorageKey() {
    try {
      const { judetId, structuraId } = getTenantContext();
      return `acreditari:jurnalisti:view:${String(judetId || "")}:${String(structuraId || "")}`;
    } catch {
      return "acreditari:jurnalisti:view";
    }
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const v = localStorage.getItem(getViewStorageKey());
      if (v === "cards" || v === "table") setView(v);
    } catch {}
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(getViewStorageKey(), view);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  function normalizeIdFromValue(value: string) {
    return String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80);
  }

  function normalizeId(nume: string, redactie: string, email?: string, telefon?: string, legit?: string) {
    const l = normalizeIdFromValue(legit || "");
    if (l) return l;
    const em = normalizeIdFromValue(String(email || "").toLowerCase());
    if (em) return em;
    const tel = normalizeIdFromValue(String(telefon || "").replace(/[^\d+]/g, ""));
    if (tel) return tel;
    const nr = normalizeIdFromValue(`${nume || ""} ${redactie || ""}`);
    return nr || `J_${Date.now()}`;
  }

  function toTitleCase(text: string) {
    const s = String(text || "").trim().toLowerCase();
    if (!s) return "";
    return s
      .split(/\s+/)
      .map((word) => word.replace(/^([a-zăâîșț]+)(.*)$/i, (_, a, b) => a.charAt(0).toUpperCase() + a.slice(1).toLowerCase() + (b || "")))
      .join(" ");
  }

  function normalizeHeader(h: string) {
    return String(h || "").trim().toLowerCase();
  }

  function mapRowFromColumns(headers: string[], cols: string[]): ImportRow {
    const idx = (name: string) => headers.indexOf(name);
    const val = (name: string) => (idx(name) >= 0 ? String(cols[idx(name)] || "").trim() : "");
    return {
      redactie: toTitleCase(val("redactie")),
      adresaRedactie: val("adresaredactie"),
      numeJurnalist: toTitleCase(val("numejurnalist")),
      telefon: val("telefon"),
      email: val("email").toLowerCase(),
      legit: val("legitimatie"),
    };
  }

  function parseCsv(text: string): ImportRow[] {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) return [] as any[];
    const delimiter = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";
    const headers = lines[0]
      .split(delimiter)
      .map((h) => normalizeHeader(h));
    const rows = lines.slice(1).map((line) => line.split(delimiter));
    return rows.map((cols) => mapRowFromColumns(headers, cols));
  }

  async function parseXlsx(file: File): Promise<ImportRow[]> {
    const XLSX = await import("xlsx");
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const firstSheet = wb.SheetNames[0];
    const ws = wb.Sheets[firstSheet];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false }) as string[][];
    if (!rows.length) return [];
    const headers = (rows[0] || []).map((h) => normalizeHeader(String(h || "")));
    return rows.slice(1).map((cols) => mapRowFromColumns(headers, cols.map((c) => String(c ?? ""))));
  }

  async function parseFile(file: File): Promise<ImportRow[]> {
    const name = file.name.toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      return await parseXlsx(file);
    }
    const text = await file.text();
    return parseCsv(text);
  }

  async function handleImport(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    try {
      setImporting(true);
      const parsed = await parseFile(file);
      const cleaned = parsed.filter((r) => r.numeJurnalist);
      if (!cleaned.length) {
        alert("Fișierul nu conține rânduri valide (coloane așteptate: redactie, adresaRedactie, numeJurnalist, telefon, email, legitimatie).");
        return;
      }
      const { judetId, structuraId } = getTenantContext();
      if (!judetId || !structuraId) {
        alert("Profil incomplet (judetId/structuraId).");
        return;
      }
      const batch = writeBatch(db);
      let count = 0;
      cleaned.forEach((r) => {
        const id = normalizeId(r.numeJurnalist, r.redactie, r.email, r.telefon, r.legit);
        const ref = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Jurnalisti/${id}`);
        batch.set(
          ref,
          {
            nume: r.numeJurnalist,
            email: r.email,
            telefon: r.telefon,
            legit: r.legit || "",
            redactie: r.redactie,
            adresaRedactie: r.adresaRedactie,
            lastAcreditareYear: null,
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
        count += 1;
      });
      await batch.commit();
      await load();
      alert(`Import complet: ${count} înregistrări salvate în ${structuraId} ${judetId}.`);
    } catch {
      alert("Nu am putut importa fișierul. Încearcă din nou cu un CSV simplu sau un XLSX standard.");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const exportYears = useMemo(() => {
    const years = Array.from(new Set(items.map((i) => i.lastAcreditareYear).filter(Boolean))) as number[];
    years.sort((a, b) => b - a);
    return years;
  }, [items]);

  function exportRows(scope: "all" | "year") {
    const list = scope === "year" ? items.filter((x) => x.lastAcreditareYear === exportYear) : items;
    return list.map((x) => ({
      nume: x.nume || "",
      email: x.email || "",
      telefon: x.telefon || "",
      legit: x.legit || "",
      redactie: x.redactie || "",
      adresaRedactie: x.adresaRedactie || "",
      lastAcreditareYear: x.lastAcreditareYear || "",
      lastAcreditareNumar: x.lastAcreditareNumar || "",
      status: x.lastAcreditareYear === currentYear ? "Acreditat" : x.lastAcreditareYear ? `Neacreditat (${x.lastAcreditareYear})` : "Neacreditat",
    }));
  }

  function downloadCsv(scope: "all" | "year") {
    const rows = exportRows(scope);
    const headers = ["nume", "email", "telefon", "legit", "redactie", "adresaRedactie", "lastAcreditareYear", "lastAcreditareNumar", "status"];
    const csv = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => `"${String((r as any)[h] ?? "").replace(/\"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jurnalisti_${scope === "year" ? exportYear : "toti"}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  async function downloadXlsx(scope: "all" | "year") {
    const XLSX = await import("xlsx");
    const rows = exportRows(scope);
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jurnalisti");
    XLSX.writeFile(wb, `jurnalisti_${scope === "year" ? exportYear : "toti"}.xlsx`);
  }

  function PaginationControls() {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg">
        <button
          type="button"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={safePage <= 1}
          className="p-1 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Pagina anterioară"
        >
          <ChevronLeft size={16} className="text-gray-600" />
        </button>
        <div className="text-sm text-gray-700">
          Pagina <span className="font-semibold">{safePage}</span>/<span className="font-semibold">{totalPages}</span>
        </div>
        <button
          type="button"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={safePage >= totalPages}
          className="p-1 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Pagina următoare"
        >
          <ChevronRight size={16} className="text-gray-600" />
        </button>
      </div>
    );
  }

  async function load() {
      try {
        setLoading(true);
        const { judetId, structuraId } = getTenantContext();
        const snap = await getDocs(collection(doc(db, `Judete/${judetId}/Structuri/${structuraId}`), "Jurnalisti"));
        setItems(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Journalist[]);
      } finally {
        setLoading(false);
      }
  }

  useEffect(() => {
    load();
  }, [db]);

  function startEdit(x: Journalist) {
    setEditingId(x.id);
    setEditDraft({
      nume: x.nume || "",
      email: x.email || "",
      telefon: x.telefon || "",
      legit: x.legit || "",
      redactie: x.redactie || "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft({ nume: "", email: "", telefon: "", legit: "", redactie: "" });
  }

  function normalizePhoneForTel(v?: string): string {
    const s = String(v || "").trim();
    if (!s) return "";
    // keep leading +, remove spaces/dashes/parentheses
    return s.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  }

  async function saveEdit(id: string) {
    const ok = confirm("Sigur vrei să salvezi modificările pentru acest jurnalist?");
    if (!ok) return;
    try {
      const { judetId, structuraId } = getTenantContext();
      const fromId = id;
      const toId = normalizeId(editDraft.nume, editDraft.redactie || "", editDraft.email, editDraft.telefon, editDraft.legit);
      const updatedAt = serverTimestamp();

      if (toId && toId !== fromId) {
        const okMove = confirm("Ai schimbat câmpuri care afectează identificarea (legitimație/email/telefon). Vrei să mut jurnalistul pe un ID nou (recomandat) ca să evităm dubluri?");
        if (!okMove) return;
        const fromRef = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Jurnalisti/${fromId}`);
        const toRef = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Jurnalisti/${toId}`);
        const exists = await getDoc(toRef);
        if (exists.exists()) {
          alert("Există deja un jurnalist cu acest ID (probabil legitimație/email/telefon identic). Selectează-l din listă și actualizează-l pe acela.");
          return;
        }
        await setDoc(toRef, { ...editDraft, updatedAt, createdAt: updatedAt }, { merge: true });
        await deleteDoc(fromRef);
        setItems((prev) => prev.map((j) => (j.id === fromId ? ({ ...j, id: toId, ...editDraft } as any) : j)));
        cancelEdit();
        return;
      }

      const ref = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Jurnalisti/${fromId}`);
      await setDoc(ref, { ...editDraft, updatedAt }, { merge: true });
      setItems((prev) => prev.map((j) => (j.id === fromId ? { ...j, ...editDraft } : j)));
      cancelEdit();
    } catch {
      alert("Nu am putut salva modificările. Încearcă din nou.");
    }
  }

  async function onDelete(id: string) {
    const ok = confirm("Sigur vrei să ștergi acest jurnalist? Acțiunea este ireversibilă.");
    if (!ok) return;
    try {
      const { judetId, structuraId } = getTenantContext();
      await deleteDoc(doc(db, `Judete/${judetId}/Structuri/${structuraId}/Jurnalisti/${id}`));
      setItems((prev) => prev.filter((x) => x.id !== id));
      if (editingId === id) cancelEdit();
    } catch {
      alert("Nu am putut șterge jurnalistul. Încearcă din nou.");
    }
  }

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items
      .filter((x) => (onlyCurrent ? x.lastAcreditareYear === currentYear : true))
      .filter((x) => !s || [x.nume, x.email, x.telefon, x.redactie, x.legit].filter(Boolean).map(String).some((v) => v.toLowerCase().includes(s)));
  }, [items, search, onlyCurrent, currentYear]);

  useEffect(() => {
    setPage(1);
  }, [search, onlyCurrent, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / Math.max(1, pageSize)));
  const safePage = Math.min(Math.max(1, page), totalPages);
  useEffect(() => {
    if (page !== safePage) setPage(safePage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safePage]);

  const paged = useMemo(() => {
    const size = Math.max(1, pageSize);
    const start = (safePage - 1) * size;
    return filtered.slice(start, start + size);
  }, [filtered, pageSize, safePage]);

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
            placeholder="Caută nume, telefon, email sau redacție..." 
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

        <div className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg">
          <span className="text-sm text-gray-600">Rânduri:</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value) || 25)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white"
          >
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        <PaginationControls />

        <div className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg">
          <span className="text-sm text-gray-600">Export:</span>
          <select
            value={exportScope}
            onChange={(e) => setExportScope(e.target.value === "year" ? "year" : "all")}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white"
          >
            <option value="year">Acreditați pe anul</option>
            <option value="all">Toți</option>
          </select>
          {exportScope === "year" && (
            <select
              value={exportYear}
              onChange={(e) => setExportYear(Number(e.target.value) || currentYear)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1 bg-white"
            >
              {[currentYear, ...exportYears.filter((y) => y !== currentYear)].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => downloadCsv(exportScope)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-900 text-white text-xs font-medium"
            title="Export CSV"
          >
            <Download size={12} />
            CSV
          </button>
          <button
            type="button"
            onClick={() => downloadXlsx(exportScope)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 text-white text-xs font-medium"
            title="Export Excel"
          >
            <Download size={12} />
            Excel
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          className="hidden"
          onChange={(e) => handleImport(e.target.files)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {importing ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
          {importing ? "Se importă..." : "Import CSV/Excel jurnaliști"}
        </button>
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
        <>
          {view === "table" ? (
            <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr className="text-left text-gray-700">
                      <th className="px-4 py-3 font-semibold">Nume</th>
                      <th className="px-4 py-3 font-semibold">Telefon</th>
                      <th className="px-4 py-3 font-semibold">Email</th>
                      <th className="px-4 py-3 font-semibold">Legitimație</th>
                      <th className="px-4 py-3 font-semibold">Redacție</th>
                      <th className="px-4 py-3 font-semibold">Nr. acreditare</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold text-right">Acțiuni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paged.map((x) => {
                      const isCurrent = x.lastAcreditareYear === currentYear;
                      const isEditing = editingId === x.id;
                      return (
                        <tr
                          key={x.id}
                          className={`hover:bg-gray-50/60 ${!isEditing ? "cursor-pointer" : ""}`}
                          onClick={() => {
                            if (isEditing) return;
                            router.push(`/acreditari/jurnalisti/${encodeURIComponent(x.id)}`);
                          }}
                        >
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <input
                                value={editDraft.nume}
                                onChange={(e) => setEditDraft((p) => ({ ...p, nume: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none bg-white"
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <div className="font-medium text-gray-900">{x.nume}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <input
                                value={editDraft.telefon || ""}
                                onChange={(e) => setEditDraft((p) => ({ ...p, telefon: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none bg-white"
                                placeholder="07xx..."
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : x.telefon ? (
                              <div className="flex items-center gap-2">
                                <span className="text-gray-700">{x.telefon}</span>
                                <a
                                  href={`tel:${normalizePhoneForTel(x.telefon)}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors text-xs font-medium"
                                  title="Apelează"
                                >
                                  <Phone size={12} />
                                  Apelează
                                </a>
                                <a
                                  href={`https://wa.me/${normalizePhoneForTel(x.telefon)}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors text-xs font-medium"
                                  title="Deschide WhatsApp"
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  WA
                                </a>
                              </div>
                            ) : (
                              <div className="text-gray-500">—</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <input
                                value={editDraft.email || ""}
                                onChange={(e) => setEditDraft((p) => ({ ...p, email: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none bg-white"
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <div className="text-gray-700">{x.email || "—"}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <input
                                value={editDraft.legit || ""}
                                onChange={(e) => setEditDraft((p) => ({ ...p, legit: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none bg-white"
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <div className="text-gray-700">{x.legit || "—"}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <input
                                value={editDraft.redactie || ""}
                                onChange={(e) => setEditDraft((p) => ({ ...p, redactie: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none bg-white"
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <div className="text-gray-700">{x.redactie || "—"}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-gray-700">{x.lastAcreditareNumar || "—"}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium ${
                                isCurrent ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {isCurrent ? "Acreditat" : x.lastAcreditareYear ? `Neacreditat (${x.lastAcreditareYear})` : "Neacreditat"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                href={`/acreditari/creaza?from=${x.id}`}
                                onClick={(e) => e.stopPropagation()}
                                onClickCapture={(e) => {
                                  e.stopPropagation();
                                  const ok = confirm("Sigur vrei să reacreditezi acest jurnalist?");
                                  if (!ok) e.preventDefault();
                                }}
                                className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
                              >
                                <RotateCcw size={14} />
                                Reacreditează
                              </Link>
                              {!isEditing ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => startEdit(x)}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClickCapture={(e) => e.stopPropagation()}
                                    className="inline-flex items-center justify-center px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-800"
                                    title="Editează"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onDelete(x.id)}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClickCapture={(e) => e.stopPropagation()}
                                    className="inline-flex items-center justify-center px-3 py-2 border border-red-200 text-red-700 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                                    title="Șterge"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => saveEdit(x.id)}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClickCapture={(e) => e.stopPropagation()}
                                    disabled={!editDraft.nume?.trim()}
                                    className="inline-flex items-center justify-center px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Salvează"
                                  >
                                    <Save size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={cancelEdit}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClickCapture={(e) => e.stopPropagation()}
                                    className="inline-flex items-center justify-center px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-800"
                                    title="Renunță"
                                  >
                                    <X size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-gray-200 text-sm text-gray-600">
                Afișezi {paged.length} din {filtered.length} rezultate (pagina {safePage}/{totalPages}).
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paged.map((x) => {
                const isCurrent = x.lastAcreditareYear === currentYear;
                const isEditing = editingId === x.id;
                return (
                  <div
                    key={x.id}
                    className={`group rounded-2xl border shadow-sm p-6 hover:shadow-xl transition-all duration-200 ${
                    isCurrent 
                      ? "bg-gradient-to-br from-green-50 to-green-100 border-green-200 hover:border-green-300" 
                      : "bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200 hover:border-yellow-300"
                  } ${!isEditing ? "cursor-pointer" : ""}`}
                    onClick={() => {
                      if (isEditing) return;
                      router.push(`/acreditari/jurnalisti/${encodeURIComponent(x.id)}`);
                    }}
                  >
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
                          : "bg-gray-200 text-gray-800"
                      }`}>
                        {isCurrent ? "Acreditat" : x.lastAcreditareYear ? `Neacreditat (${x.lastAcreditareYear})` : "Neacreditat"}
                      </div>
                    </div>
                    
                    {!isEditing ? (
                    <div className="space-y-2 mb-4">
                      {x.email && (
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Mail size={14} className="text-gray-400" />
                          <span className="truncate">{x.email}</span>
                        </div>
                      )}
                      {x.telefon && (
                        <div className="flex items-center justify-between gap-2 text-sm text-gray-700">
                          <div className="flex items-center gap-2 min-w-0">
                            <Phone size={14} className="text-gray-400" />
                            <span className="truncate">{x.telefon}</span>
                          </div>
                          <a
                            href={`tel:${normalizePhoneForTel(x.telefon)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors text-xs font-medium"
                            title="Apelează"
                          >
                            <Phone size={12} />
                            Apelează
                          </a>
                          <a
                            href={`https://wa.me/${normalizePhoneForTel(x.telefon)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors text-xs font-medium"
                            title="Deschide WhatsApp"
                            target="_blank"
                            rel="noreferrer"
                          >
                            WA
                          </a>
                        </div>
                      )}
                      {x.legit && (
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <IdCard size={14} className="text-gray-400" />
                          <span>Legitimație: {x.legit}</span>
                        </div>
                      )}
                      {x.lastAcreditareNumar && (
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <IdCard size={14} className="text-gray-400" />
                          <span>Nr. acreditare: {x.lastAcreditareNumar}</span>
                        </div>
                      )}
                      {x.redactie && (
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <Building2 size={14} className="text-gray-400" />
                          <span className="truncate">{x.redactie}</span>
                        </div>
                      )}
                    </div>
                    ) : (
                      <div className="space-y-3 mb-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Nume</label>
                          <input
                            value={editDraft.nume}
                            onChange={(e) => setEditDraft((p) => ({ ...p, nume: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none bg-white"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                            <input
                              value={editDraft.email || ""}
                              onChange={(e) => setEditDraft((p) => ({ ...p, email: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Telefon</label>
                            <input
                              value={editDraft.telefon || ""}
                              onChange={(e) => setEditDraft((p) => ({ ...p, telefon: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none bg-white"
                              placeholder="07xx..."
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Legitimație</label>
                            <input
                              value={editDraft.legit || ""}
                              onChange={(e) => setEditDraft((p) => ({ ...p, legit: e.target.value }))}
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none bg-white"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Redacție</label>
                          <input
                            value={editDraft.redactie || ""}
                            onChange={(e) => setEditDraft((p) => ({ ...p, redactie: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none bg-white"
                          />
                        </div>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Link 
                        href={`/acreditari/creaza?from=${x.id}`} 
                        onClick={(e) => e.stopPropagation()}
                        onClickCapture={(e) => {
                          e.stopPropagation();
                          const ok = confirm("Sigur vrei să reacreditezi acest jurnalist?");
                          if (!ok) e.preventDefault();
                        }}
                        className="inline-flex items-center gap-2 flex-1 justify-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
                      >
                        <RotateCcw size={14} />
                        Reacreditează
                      </Link>
                      {!isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(x)}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClickCapture={(e) => e.stopPropagation()}
                            className="inline-flex items-center justify-center px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-800"
                            title="Editează"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(x.id)}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClickCapture={(e) => e.stopPropagation()}
                            className="inline-flex items-center justify-center px-3 py-2 border border-red-200 text-red-700 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                            title="Șterge"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => saveEdit(x.id)}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClickCapture={(e) => e.stopPropagation()}
                            disabled={!editDraft.nume?.trim()}
                            className="inline-flex items-center justify-center px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Salvează"
                          >
                            <Save size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClickCapture={(e) => e.stopPropagation()}
                            className="inline-flex items-center justify-center px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-800"
                            title="Renunță"
                          >
                            <X size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex justify-end mt-4">
            <PaginationControls />
          </div>
        </>
      )}
    </div>
  );
}
