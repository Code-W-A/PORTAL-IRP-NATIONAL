"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useBicpData, type Bicp } from "@/app/(admin-irp)/lista-BICP/hooks/useBicpData";
import { deleteDoc, doc, collection } from "firebase/firestore";
import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";
import { Grid2X2, Rows2, RefreshCw, Search, FileText, FileDown, Copy as CopyIcon, Trash2, Filter, ChevronUp, ChevronDown, X, Pencil, Printer, Loader2, FilePlus2, CheckSquare, Download, Mail, MoreVertical } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AdvancedFiltersPanel } from "./components/AdvancedFiltersPanel";
import {
  BICP_VIEW_MODE_KEY,
  type BicpViewMode,
  btnAccent,
  btnBase,
  btnPrimaryGreen,
  btnSecondary,
  chipBase,
  DocumentBadge,
  getDefaultViewMode,
  getYearMetaLabel,
  inputBase,
  pageBg,
  selectBase,
  subtleShadow,
  surface,
} from "./constants/ui";
import { useAuth } from "@/app/(admin-irp)/providers/AuthProvider";
import { BULK_PDF_MAX_IDS, BULK_ZIP_CONCURRENCY } from "@/lib/bicp/bulkLimits";
import { SendPublicPdfEmailDialog } from "./SendPublicPdfEmailDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Filters } from "./hooks/useBicpData";

// Helper function to format date consistently as DD/MM/YYYY
function formatDate(doc: any): string {
  // Check if there's a dataTimestamp (Firestore Timestamp)
  if (doc.dataTimestamp?.toDate) {
    const date = doc.dataTimestamp.toDate();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
  
  // Check if data is already a string
  if (doc.data && typeof doc.data === "string") {
    const str = doc.data.trim();
    // Check if it's already in DD/MM/YYYY format
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
      return str;
    }
    // Check if it's in YYYY-MM-DD format (ISO)
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [year, month, day] = str.split('-');
      return `${day}/${month}/${year}`;
    }
    // Return as-is if it's some other format
    return str;
  }
  
  // Check if data is a Firestore Timestamp object directly
  if (doc.data?.toDate) {
    const date = doc.data.toDate();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
  
  return "—";
}

type ToastType = "info" | "success" | "error";
type ToastState = { type: ToastType; message: string } | null;

export default function ListaBicpPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { db } = initFirebase();
  const { isAdmin } = useAuth();
  const { loading, error, filters, setFilters, items, total, availableYears, reload } = useBicpData();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [view, setView] = useState<BicpViewMode>(() => getDefaultViewMode());
  const [advancedFiltersOpen, setAdvancedFiltersOpen] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [downloadingZipType, setDownloadingZipType] = useState<"signed" | "public" | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{
    kind: "print" | "zip";
    variant: "signed" | "public";
    done: number;
    total: number;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; ids: string[]; isBulk: boolean }>({ show: false, ids: [], isBulk: false });
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendDialogDoc, setSendDialogDoc] = useState<Bicp | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deniedHandledRef = useRef(false);

  const allSelectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);
  const currentPageIds = useMemo(() => items.map((x) => x.id), [items]);
  const allPageSelected = useMemo(() => currentPageIds.length > 0 && currentPageIds.every((id) => selected[id]), [currentPageIds, selected]);
  const toggleSelectPage = (val: boolean) => {
    const m = { ...selected } as Record<string, boolean>;
    currentPageIds.forEach((id) => { m[id] = val; });
    setSelected(m);
  };

  const selectedYear = (typeof (filters as any).year === "number" && Number.isFinite((filters as any).year))
    ? (filters as any).year
    : new Date().getFullYear();
  const currentYear = new Date().getFullYear();

  function showToast(message: string, type: ToastType = "info", durationMs = 3200) {
    setToast({ type, message });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), durationMs);
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(BICP_VIEW_MODE_KEY, view);
  }, [view]);

  function resetAllFilters() {
    setFilters({
      ...filters,
      search: "",
      tipDocument: "",
      semnatarCat: "",
      numeSemnatar: "",
      grad: "",
      functia: "",
      pentru: "",
      purtatorCuvant: "",
      numarMin: undefined,
      numarMax: undefined,
      dataStart: undefined,
      dataEnd: undefined,
      page: 1,
    });
  }

  useEffect(() => {
    if (deniedHandledRef.current) return;
    if (searchParams.get("accessDenied") !== "1") return;
    deniedHandledRef.current = true;
    showToast("Nu ai acces", "error");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("accessDenied");
    const nextQuery = params.toString();
    router.replace(nextQuery ? `/lista-BICP?${nextQuery}` : "/lista-BICP");
  }, [router, searchParams]);

  async function downloadBulkPdfsAsZip(variant: "signed" | "public") {
    if (!allSelectedIds.length || downloadingZipType || isPrinting) return;
    const n = allSelectedIds.length;
    const label = variant === "signed" ? "cu semnături" : "fără semnături";
    if (
      !window.confirm(
        `Descarci arhivă ZIP cu ${n} PDF-uri ${label}?\n\nPoate dura câteva momente pentru volume mari.`
      )
    ) {
      return;
    }

    const { auth } = initFirebase();
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      showToast("Trebuie să fii autentificat.", "error");
      return;
    }

    setDownloadingZipType(variant);
    setBulkProgress({ kind: "zip", variant, done: 0, total: n });
    showToast(`Se pregătește ZIP-ul (${n} documente ${label})...`, "info", 4000);

    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const { judetId, structuraId } = getTenantContext();
      const today = new Date();
      const dateStr = `${today.getDate().toString().padStart(2, "0")}-${(today.getMonth() + 1)
        .toString()
        .padStart(2, "0")}-${today.getFullYear()}`;

      const slugifyFilename = (input: string): string => {
        const map: Record<string, string> = {
          ă: "a", â: "a", î: "i", ș: "s", ş: "s", ț: "t", ţ: "t",
          Ă: "A", Â: "A", Î: "I", Ș: "S", Ş: "S", Ț: "T", Ţ: "T",
        };
        const normalized = Array.from(input)
          .map((ch) => map[ch] || ch)
          .join("");
        return (
          normalized
            .replace(/[^a-zA-Z0-9._\-\s]+/g, " ")
            .replace(/\s{2,}/g, " ")
            .trim()
            .slice(0, 150) || "Document"
        );
      };

      const usedNames = new Set<string>();
      const uniqueName = (name: string) => {
        if (!usedNames.has(name)) {
          usedNames.add(name);
          return name;
        }
        const base = name.replace(/\.pdf$/i, "");
        let i = 2;
        let next = `${base}_${i}.pdf`;
        while (usedNames.has(next)) {
          i += 1;
          next = `${base}_${i}.pdf`;
        }
        usedNames.add(next);
        return next;
      };

      let successCount = 0;
      let failCount = 0;
      let completed = 0;

      const fetchOne = async (id: string) => {
        const url = `/api/comunicate/${id}/pdf?variant=${variant === "public" ? "public" : "signed"}&judetId=${encodeURIComponent(judetId)}&structuraId=${encodeURIComponent(structuraId)}&debug=1`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) throw new Error(`Failed to fetch ${id}`);
        const blob = await response.blob();
        const contentDisp = response.headers.get("Content-Disposition");
        let filename = `document_${id}.pdf`;
        if (contentDisp) {
          const filenameMatch = contentDisp.match(/filename="?([^"]+)"?/i);
          if (filenameMatch?.[1]) filename = filenameMatch[1];
        } else {
          const docInfo = items.find((item) => item.id === id);
          if (docInfo) {
            const numar = String(docInfo.numarComunicat || docInfo.numar || "");
            const tip = String(docInfo.nume || docInfo.tip || "");
            const titlu = String(docInfo.titlu || "");
            filename = `${slugifyFilename([numar, tip, titlu].filter(Boolean).join("-"))}.pdf`;
          }
        }
        if (variant === "public") {
          filename = filename.replace(/\.pdf$/i, "_fara_semnaturi.pdf");
        }
        zip.file(uniqueName(filename), blob);
        successCount += 1;
      };

      for (let i = 0; i < allSelectedIds.length; i += BULK_ZIP_CONCURRENCY) {
        const chunk = allSelectedIds.slice(i, i + BULK_ZIP_CONCURRENCY);
        const results = await Promise.allSettled(chunk.map((id) => fetchOne(id)));
        for (const r of results) {
          if (r.status === "rejected") {
            failCount += 1;
            console.error("Failed to download PDF for ZIP:", r.reason);
          }
          completed += 1;
        }
        setBulkProgress({ kind: "zip", variant, done: completed, total: n });
      }

      if (successCount === 0) {
        showToast("Nu s-a putut descărca niciun PDF.", "error");
        return;
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `Documente_${variant === "signed" ? "Semnate" : "Fara_Semnaturi"}_${dateStr}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      if (failCount > 0) {
        showToast(
          `ZIP descărcat: ${successCount} din ${n} documente (${failCount} eșuate).`,
          "info",
          5500
        );
      } else {
        showToast(`ZIP descărcat: ${successCount} documente.`, "success", 4000);
      }
    } catch (err) {
      console.error("Error creating ZIP:", err);
      showToast("Eroare la crearea arhivei ZIP.", "error");
    } finally {
      setDownloadingZipType(null);
      setBulkProgress(null);
    }
  }

  async function startBulkPrint(variant: "signed" | "public") {
    if (!allSelectedIds.length || isPrinting || downloadingZipType) return;
    const n = allSelectedIds.length;
    if (n > BULK_PDF_MAX_IDS) {
      showToast(
        `Poți tipări maxim ${BULK_PDF_MAX_IDS} documente odată. Ai selectat ${n}. Deselectează câteva sau folosește ZIP.`,
        "error",
        6000
      );
      return;
    }

    const label = variant === "signed" ? "cu semnături" : "fără semnături";
    if (
      !window.confirm(
        `Tipărești ${n} documente ${label} într-un singur PDF combinat?\n\nSe va deschide dialogul de tipărire al browserului.`
      )
    ) {
      return;
    }

    const { auth } = initFirebase();
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      showToast("Trebuie să fii autentificat.", "error");
      return;
    }

    setIsPrinting(true);
    setBulkProgress({ kind: "print", variant, done: 0, total: n });
    showToast(`Se generează PDF-ul combinat (${n} documente ${label})...`, "info", 5000);

    try {
      const res = await fetch(`/api/comunicate/bulk-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids: allSelectedIds, variant }),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => null)) as { error?: string } | null;
        showToast(errBody?.error || "Eroare la generarea PDF-ului combinat.", "error", 5500);
        return;
      }

      const included = Number(res.headers.get("X-Bulk-Included") || "0");
      const missing = Number(res.headers.get("X-Bulk-Missing") || "0");
      setBulkProgress({ kind: "print", variant, done: included || n, total: n });

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
        try {
          document.body.removeChild(iframe);
        } catch {}
        try {
          URL.revokeObjectURL(url);
        } catch {}
      };
      const afterPrintPromise = new Promise<void>((resolve) => {
        const handler = () => {
          try {
            win?.removeEventListener("afterprint", handler as any);
          } catch {}
          try {
            window.removeEventListener("focus", onFocus, { capture: true } as any);
          } catch {}
          resolve();
        };
        const onFocus = () => {
          handler();
        };
        try {
          win?.addEventListener("afterprint", handler as any);
        } catch {}
        try {
          window.addEventListener("focus", onFocus, { once: true, capture: true } as any);
        } catch {}
        setTimeout(handler, 20000);
      });
      try {
        win?.focus();
      } catch {}
      try {
        win?.print();
      } catch {}
      await afterPrintPromise;
      cleanup();

      if (missing > 0) {
        showToast(
          `Tipărire: ${included} din ${n} documente (lipsă: ${missing}).`,
          "info",
          5500
        );
      } else {
        showToast(`PDF combinat (${included} documente) trimis la tipărire.`, "success", 4000);
      }
    } catch {
      showToast("Eroare la generarea PDF-ului combinat.", "error");
    } finally {
      setIsPrinting(false);
      setBulkProgress(null);
    }
  }

  async function printSingle(id: string, variant: "signed" | "public" = "signed") {
    if (isPrinting) return;
    setIsPrinting(true);
    setPrintingId(id);
    showToast("Se pregătește documentul pentru tipărire...", "info", 2400);
    try {
      const { judetId, structuraId } = getTenantContext();
      const url = `/api/comunicate/${id}/pdf?variant=${variant}&disposition=inline&judetId=${encodeURIComponent(judetId)}&structuraId=${encodeURIComponent(structuraId)}&debug=1`;
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
      showToast("Document deschis pentru tipărire.", "success");
    } catch (e) {
      showToast("Eroare la tipărirea documentului.", "error");
    }
    setIsPrinting(false);
    setPrintingId(null);
  }

  function showDeleteConfirmation(ids: string[], isBulk: boolean = false) {
    setDeleteConfirm({ show: true, ids, isBulk });
  }

  function openSendDialog(item: Bicp) {
    setSendDialogDoc(item);
    setSendDialogOpen(true);
  }

  function handleSendDialogOpenChange(nextOpen: boolean) {
    setSendDialogOpen(nextOpen);
    if (!nextOpen) setSendDialogDoc(null);
  }

  async function executeDelete() {
    const { ids, isBulk } = deleteConfirm;
    setDeleteConfirm({ show: false, ids: [], isBulk: false });
    
    try {
      const { judetId, structuraId } = getTenantContext();
      const collectionPath = collection(doc(db, `Judete/${judetId}/Structuri/${structuraId}`), "Comunicate");
      await Promise.all(ids.map((id) => deleteDoc(doc(collectionPath, id))));
      if (isBulk) setSelected({});
      reload();
      showToast(ids.length === 1 ? "Document șters cu succes." : `${ids.length} documente au fost șterse.`, "success");
    } catch (error) {
      console.error("Eroare la ștergerea documentelor:", error);
      showToast("Eroare la ștergerea documentelor.", "error");
    }
  }

  return (
    <div className={`min-h-screen ${pageBg}`}>
      <div className="max-w-screen-2xl mx-auto px-4 py-5">
        {/* Header */}
        <div className="mb-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 shrink-0 rounded-lg bg-[#EFF6FF] flex items-center justify-center">
                <FileText size={18} className="text-[#1D4ED8]" />
              </div>
              <div className="min-w-0 space-y-2">
                <h1 className="text-xl font-semibold text-[#111827]">Lista Documente BI/CP</h1>
                <p className="text-sm text-[#64748B]">
                  {total} documente • An {selectedYear} • {getYearMetaLabel(selectedYear, currentYear)}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedYear}
                    onChange={(e) => setFilters({ ...filters, year: Number(e.target.value), page: 1 })}
                    className={selectBase}
                    title="Selectează anul"
                    aria-label="Selectează anul"
                  >
                    {(availableYears?.length ? [...new Set(availableYears)].sort((a, b) => b - a) : [new Date().getFullYear()]).map((y: number) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setFilters({ ...filters, year: currentYear, page: 1 })}
                    className={`${btnBase} border ${
                      selectedYear === currentYear
                        ? "bg-[#1D4ED8] text-white border-[#1D4ED8]"
                        : "bg-white border-[#E5E7EB] text-[#334155] hover:bg-[#F8FAFC]"
                    }`}
                    title="Sari la anul curent"
                  >
                    An curent
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilters({ ...filters, year: currentYear - 1, page: 1 })}
                    className={`${btnBase} border ${
                      selectedYear === currentYear - 1
                        ? "bg-[#1D4ED8] text-white border-[#1D4ED8]"
                        : "bg-white border-[#E5E7EB] text-[#334155] hover:bg-[#F8FAFC]"
                    }`}
                    title="Deschide arhiva (anul precedent)"
                  >
                    Arhivă
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto xl:justify-end">
              <Link href="/creaza-BICP" className={btnPrimaryGreen}>
                <FilePlus2 size={16} /> Creează BI/CP
              </Link>
              <button type="button" onClick={reload} className={btnSecondary}>
                <RefreshCw size={16} /> Actualizează
              </button>
              <div className={`inline-flex rounded-lg overflow-hidden border border-[#E5E7EB] ${subtleShadow}`}>
                <button
                  type="button"
                  className={`${btnBase} rounded-none border-0 ${
                    view === "card"
                      ? "bg-[#1D4ED8] text-white"
                      : "bg-white text-[#334155] hover:bg-[#F8FAFC]"
                  }`}
                  onClick={() => setView("card")}
                  aria-pressed={view === "card"}
                >
                  <Grid2X2 size={16} /> Carduri
                </button>
                <button
                  type="button"
                  className={`${btnBase} rounded-none border-0 border-l border-[#E5E7EB] ${
                    view === "table"
                      ? "bg-[#1D4ED8] text-white"
                      : "bg-white text-[#334155] hover:bg-[#F8FAFC]"
                  }`}
                  onClick={() => setView("table")}
                  aria-pressed={view === "table"}
                >
                  <Rows2 size={16} /> Listă
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectMode((s) => !s);
                  if (selectMode) setSelected({});
                }}
                className={
                  selectMode
                    ? `${btnAccent} border border-[#1D4ED8]`
                    : btnSecondary
                }
              >
                <CheckSquare size={16} />
                {selectMode ? "Anulează selecția" : "Selectează documente"}
              </button>
            </div>
          </div>
        </div>

        {/* Selection Toolbar */}
        {selectMode && (
          <div className="mb-4">
            <div className={`rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] p-3 ${subtleShadow}`}>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[#111827]">
                    {allSelectedIds.length > 0
                      ? `${allSelectedIds.length} ${allSelectedIds.length === 1 ? "document selectat" : "documente selectate"}`
                      : "Nici un document selectat"}
                  </p>
                  <p className="text-xs text-[#64748B]">Bifează documentele pentru acțiuni în bloc</p>
                </div>

                {allSelectedIds.length > 0 && (
                  <div className="flex flex-col gap-2 w-full">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleSelectPage(!allPageSelected)}
                        className={btnSecondary}
                        title={allPageSelected ? "Deselectează pagina curentă" : "Selectează pagina curentă"}
                      >
                        {allPageSelected ? "Deselectează pagina" : "Selectează pagina"}
                      </button>
                      <span className={chipBase}>
                        Selectate: <span className="font-semibold">{allSelectedIds.length}</span>
                        <button
                          type="button"
                          onClick={() => setSelected({})}
                          className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-[#E5E7EB] text-[#64748B]"
                          title="Deselectează toate"
                          aria-label="Deselectează toate"
                        >
                          <X size={12} />
                        </button>
                      </span>
                      <button
                        type="button"
                        onClick={() => startBulkPrint("signed")}
                        disabled={
                          isPrinting ||
                          downloadingZipType !== null ||
                          allSelectedIds.length > BULK_PDF_MAX_IDS
                        }
                        className={`${btnPrimaryGreen} disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={
                          allSelectedIds.length > BULK_PDF_MAX_IDS
                            ? `Maxim ${BULK_PDF_MAX_IDS} documente la tipărire combinată — folosește ZIP`
                            : `Tipărește ${allSelectedIds.length} documente cu semnături într-un PDF combinat`
                        }
                      >
                        {isPrinting && bulkProgress?.variant === "signed" ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <Printer size={16} />
                        )}
                        {isPrinting && bulkProgress?.kind === "print" && bulkProgress.variant === "signed"
                          ? "Se generează..."
                          : `Printează ${allSelectedIds.length} cu semnături`}
                      </button>
                      <button
                        type="button"
                        onClick={() => startBulkPrint("public")}
                        disabled={
                          isPrinting ||
                          downloadingZipType !== null ||
                          allSelectedIds.length > BULK_PDF_MAX_IDS
                        }
                        className={`${btnSecondary} disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={
                          allSelectedIds.length > BULK_PDF_MAX_IDS
                            ? `Maxim ${BULK_PDF_MAX_IDS} documente la tipărire combinată — folosește ZIP`
                            : `Tipărește ${allSelectedIds.length} documente fără semnături într-un PDF combinat`
                        }
                      >
                        {isPrinting && bulkProgress?.variant === "public" ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <Printer size={16} />
                        )}
                        {isPrinting && bulkProgress?.kind === "print" && bulkProgress.variant === "public"
                          ? "Se generează..."
                          : `Printează ${allSelectedIds.length} fără semnături`}
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadBulkPdfsAsZip("signed")}
                        disabled={downloadingZipType !== null || isPrinting}
                        className={`${btnSecondary} disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {downloadingZipType === "signed" ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <Download size={16} />
                        )}
                        {downloadingZipType === "signed"
                          ? bulkProgress
                            ? `ZIP ${bulkProgress.done}/${bulkProgress.total}...`
                            : "Se creează..."
                          : `ZIP semnate (${allSelectedIds.length})`}
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadBulkPdfsAsZip("public")}
                        disabled={downloadingZipType !== null || isPrinting}
                        className={`${btnSecondary} disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {downloadingZipType === "public" ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <Download size={16} />
                        )}
                        {downloadingZipType === "public"
                          ? bulkProgress
                            ? `ZIP ${bulkProgress.done}/${bulkProgress.total}...`
                            : "Se creează..."
                          : `ZIP fără semnături (${allSelectedIds.length})`}
                      </button>
                      <button
                        type="button"
                        onClick={() => showDeleteConfirmation(allSelectedIds, true)}
                        disabled={isPrinting || downloadingZipType !== null}
                        className={`${btnBase} bg-[#DC2626] hover:bg-[#B91C1C] text-white border border-[#DC2626] disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <Trash2 size={16} /> Șterge
                      </button>
                    </div>
                    {bulkProgress && (
                      <div className="w-full max-w-md">
                        <div className="flex items-center justify-between text-xs text-[#64748B] mb-1">
                          <span>
                            {bulkProgress.kind === "print"
                              ? "Generare PDF combinat"
                              : "Descărcare PDF-uri în ZIP"}
                          </span>
                          <span>
                            {bulkProgress.done}/{bulkProgress.total}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#E5E7EB] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-[#059669] transition-[width] duration-200"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round((bulkProgress.done / Math.max(1, bulkProgress.total)) * 100)
                              )}%`,
                            }}
                          />
                        </div>
                        {bulkProgress.kind === "print" && allSelectedIds.length > BULK_PDF_MAX_IDS && (
                          <p className="text-xs text-[#B45309] mt-1">
                            Maxim {BULK_PDF_MAX_IDS} documente la tipărire combinată.
                          </p>
                        )}
                      </div>
                    )}
                    {!bulkProgress && allSelectedIds.length > BULK_PDF_MAX_IDS && (
                      <p className="text-xs text-[#B45309]">
                        Tipărirea combinată e limitată la {BULK_PDF_MAX_IDS} documente. Folosește ZIP pentru volume mai mari.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mb-5">
          <div className={`rounded-lg p-3 ${surface} ${subtleShadow}`}>
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <div className="relative flex-1 w-full">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  placeholder="Caută în titlu, conținut sau nume afișare..."
                  className={`${inputBase} pl-9`}
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
                />
              </div>
              <button
                type="button"
                onClick={() => setAdvancedFiltersOpen((open) => !open)}
                className={`${btnSecondary} w-full sm:w-auto`}
                aria-expanded={advancedFiltersOpen}
              >
                <Filter size={16} /> Filtre avansate
                {advancedFiltersOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>

            {advancedFiltersOpen && (
              <AdvancedFiltersPanel
                filters={filters}
                setFilters={setFilters}
                onApplied={() => setAdvancedFiltersOpen(false)}
              />
            )}

            {(() => {
              const chips: { key: string; label: string; onClear: () => void }[] = [];
              if (filters.tipDocument) chips.push({ key: `tipDocument:${filters.tipDocument}`, label: `Tip: ${filters.tipDocument}`, onClear: () => setFilters({ ...filters, tipDocument: "", page: 1 }) });
              if (filters.semnatarCat) chips.push({ key: `semnatar:${filters.semnatarCat}`, label: `Semnatar: ${filters.semnatarCat}`, onClear: () => setFilters({ ...filters, semnatarCat: "", page: 1 }) });
              if (filters.numeSemnatar) chips.push({ key: `numeSemnatar:${filters.numeSemnatar}`, label: `Nume semnatar: ${filters.numeSemnatar}`, onClear: () => setFilters({ ...filters, numeSemnatar: "", page: 1 }) });
              if (filters.grad) chips.push({ key: `grad:${filters.grad}`, label: `Grad: ${filters.grad}`, onClear: () => setFilters({ ...filters, grad: "", page: 1 }) });
              if (filters.functia) chips.push({ key: `functia:${filters.functia}`, label: `Funcția: ${filters.functia}`, onClear: () => setFilters({ ...filters, functia: "", page: 1 }) });
              if (filters.pentru) chips.push({ key: `pentru:${filters.pentru}`, label: `Pentru: ${filters.pentru}`, onClear: () => setFilters({ ...filters, pentru: "", page: 1 }) });
              if (filters.purtatorCuvant) chips.push({ key: `purtator:${filters.purtatorCuvant}`, label: `Purtător: ${filters.purtatorCuvant}`, onClear: () => setFilters({ ...filters, purtatorCuvant: "", page: 1 }) });
              if (filters.numarMin != null) chips.push({ key: `min:${filters.numarMin}`, label: `Nr ≥ ${filters.numarMin}`, onClear: () => setFilters({ ...filters, numarMin: undefined, page: 1 }) });
              if (filters.numarMax != null) chips.push({ key: `max:${filters.numarMax}`, label: `Nr ≤ ${filters.numarMax}`, onClear: () => setFilters({ ...filters, numarMax: undefined, page: 1 }) });
              if (filters.dataStart) chips.push({ key: `start:${filters.dataStart}`, label: `De la: ${filters.dataStart}`, onClear: () => setFilters({ ...filters, dataStart: undefined, page: 1 }) });
              if (filters.dataEnd) chips.push({ key: `end:${filters.dataEnd}`, label: `Până la: ${filters.dataEnd}`, onClear: () => setFilters({ ...filters, dataEnd: undefined, page: 1 }) });
              if (filters.search) chips.push({ key: `search:${filters.search}`, label: `Căutare: ${filters.search}`, onClear: () => setFilters({ ...filters, search: "", page: 1 }) });
              return chips.length ? (
                <div className="flex flex-wrap gap-2 max-h-24 overflow-auto pt-3 mt-3 border-t border-[#E5E7EB]">
                  {chips.map((c) => (
                    <span key={c.key} className={chipBase}>
                      {c.label}
                      <button
                        type="button"
                        onClick={c.onClear}
                        className="inline-flex items-center justify-center w-4 h-4 rounded hover:bg-[#E5E7EB]"
                        aria-label={`Elimină filtrul ${c.label}`}
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                  <button type="button" onClick={resetAllFilters} className={chipBase} title="Resetează toate filtrele">
                    Curăță filtrele
                  </button>
                </div>
              ) : null;
            })()}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 mb-4 text-sm">
            <strong>Eroare:</strong> {error}
          </div>
        )}

        {loading ? (
          view === "card" ? <CardSkeletons /> : <TableSkeletons />
        ) : !items.length ? (
          <div className={`text-center py-16 rounded-lg ${surface} ${subtleShadow}`}>
            <FileText size={40} className="mx-auto text-[#CBD5E1] mb-3" />
            <h3 className="text-base font-semibold text-[#111827] mb-1">Nu au fost găsite documente</h3>
            <p className="text-sm text-[#64748B] mb-4">Modifică filtrele sau caută după alt termen.</p>
            <button type="button" onClick={resetAllFilters} className={btnSecondary}>
              Resetează filtrele
            </button>
          </div>
        ) : null}

        {!loading && items.length > 0 && (
          view === "card" ? (
            <CardView
              items={items}
              selectMode={selectMode}
              selected={selected}
              setSelected={setSelected}
              printSingle={printSingle}
              isPrinting={isPrinting}
              printingId={printingId}
              onDelete={(id) => showDeleteConfirmation([id], false)}
              canSendEmail={isAdmin}
              canDownloadCompactPdf={isAdmin}
              onSendPublicPdf={openSendDialog}
              showToast={showToast}
            />
          ) : (
            <TableView
              items={items}
              selectMode={selectMode}
              selected={selected}
              setSelected={setSelected}
              filters={filters}
              setFilters={setFilters}
              printSingle={printSingle}
              isPrinting={isPrinting}
              printingId={printingId}
              onDelete={(id) => showDeleteConfirmation([id], false)}
              canSendEmail={isAdmin}
              canDownloadCompactPdf={isAdmin}
              onSendPublicPdf={openSendDialog}
              showToast={showToast}
            />
          )
        )}

        {!loading && (
          <Pagination
            total={total}
            page={filters.page}
            pageSize={filters.pageSize}
            onChange={(p) => setFilters({ ...filters, page: p })}
            onChangePageSize={(s) => setFilters({ ...filters, pageSize: s, page: 1 })}
          />
        )}

        {/* Delete Confirmation Dialog */}
        {deleteConfirm.show && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDeleteConfirm({ show: false, ids: [], isBulk: false })}>
            <div className={`rounded-xl max-w-md w-full ${surface} ${subtleShadow}`} onClick={(e) => e.stopPropagation()}>
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
                    <Trash2 size={20} className="text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#111827]">Confirmare ștergere</h3>
                    <p className="text-sm text-[#64748B]">Această acțiune este permanentă</p>
                  </div>
                </div>

                <p className="text-sm text-[#334155] mb-5">
                  {deleteConfirm.ids.length === 1
                    ? "Sigur doriți să ștergeți acest document? Acțiunea nu poate fi anulată."
                    : `Sigur doriți să ștergeți ${deleteConfirm.ids.length} documente? Acțiunea nu poate fi anulată.`}
                </p>

                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm({ show: false, ids: [], isBulk: false })}
                    className={btnSecondary}
                  >
                    Anulează
                  </button>
                  <button
                    type="button"
                    onClick={executeDelete}
                    className={`${btnBase} bg-[#DC2626] hover:bg-[#B91C1C] text-white border border-[#DC2626]`}
                  >
                    Șterge {deleteConfirm.ids.length > 1 ? `(${deleteConfirm.ids.length})` : ""}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <Link
          href="/creaza-BICP"
          className="md:hidden fixed bottom-20 right-4 w-12 h-12 bg-[#047857] hover:bg-[#065f46] text-white rounded-full flex items-center justify-center z-50 shadow-[0_1px_2px_rgba(15,23,42,0.12)]"
          title="Creează document BI/CP"
          aria-label="Creează document BI/CP"
        >
          <FilePlus2 size={22} strokeWidth={2} />
        </Link>

        {toast && (
          <div className="fixed right-4 bottom-4 z-[70]">
            <div
              className={`max-w-sm rounded-lg border px-4 py-2.5 text-sm font-medium ${subtleShadow} ${
                toast.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : toast.type === "error"
                    ? "border-red-200 bg-red-50 text-red-900"
                    : "border-[#BFDBFE] bg-[#EFF6FF] text-[#1E3A8A]"
              }`}
            >
              {toast.message}
            </div>
          </div>
        )}

        <SendPublicPdfEmailDialog
          open={sendDialogOpen}
          onOpenChange={handleSendDialogOpenChange}
          documentItem={sendDialogDoc}
        />
      </div>
    </div>
  );
}

function CardView({
  items,
  selectMode,
  selected,
  setSelected,
  printSingle,
  isPrinting,
  printingId,
  onDelete,
  canSendEmail,
  canDownloadCompactPdf,
  onSendPublicPdf,
  showToast,
}: {
  items: Bicp[];
  selectMode: boolean;
  selected: Record<string, boolean>;
  setSelected: (m: Record<string, boolean>) => void;
  printSingle: (id: string, variant?: "signed" | "public") => void;
  isPrinting: boolean;
  printingId: string | null;
  onDelete: (id: string) => void;
  canSendEmail: boolean;
  canDownloadCompactPdf: boolean;
  onSendPublicPdf: (item: Bicp) => void;
  showToast: (message: string, type?: ToastType, durationMs?: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-4">
      {items.map((x) => {
        const isSelected = !!selected[x.id];

        const toggleSelection = () => {
          if (selectMode) {
            setSelected({ ...selected, [x.id]: !isSelected });
          }
        };

        return (
          <div
            key={x.id}
            className={`relative rounded-[10px] p-4 ${surface} ${subtleShadow} transition-colors ${
              isSelected ? "ring-2 ring-[#1D4ED8] border-[#BFDBFE] bg-[#F8FAFC]" : "hover:border-[#CBD5E1]"
            } ${selectMode ? "cursor-pointer" : ""}`}
            onClick={toggleSelection}
          >
            {selectMode && (
              <div className="absolute top-3 right-3 pointer-events-none">
                <input
                  type="checkbox"
                  checked={isSelected}
                  readOnly
                  className="w-4 h-4 text-[#1D4ED8] border-[#E5E7EB] rounded focus:ring-[#1D4ED8]"
                />
              </div>
            )}

            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <FileText size={16} className="text-[#64748B] shrink-0" />
                <DocumentBadge tipDocument={x.nume || x.tip || ""} />
              </div>
              <span className="text-sm font-bold text-[#111827] shrink-0">
                Nr. {x.numarComunicat ?? x.numar}
              </span>
            </div>

            <h3 className="text-sm font-semibold text-[#111827] line-clamp-2 leading-snug mb-2 min-h-[2.5rem]">
              {x.titlu || "Fără titlu"}
            </h3>

            <p className="text-[13px] text-[#64748B] mb-3">
              Data: {formatDate(x)}
            </p>

            <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className={`${btnSecondary} h-8 px-2.5 text-xs`}
                onClick={() => copyText("Titlu", x.titlu || "", showToast)}
                title="Copiază titlu"
                aria-label="Copiază titlu"
              >
                <CopyIcon size={12} />
                Copiază titlu
              </button>
              <button
                type="button"
                className={`${btnSecondary} h-8 px-2.5 text-xs`}
                onClick={() => copyText("Conținut", x.comunicat || "", showToast)}
                title="Copiază conținut"
                aria-label="Copiază conținut"
              >
                <CopyIcon size={12} />
                Copiază conținut
              </button>
              <DocumentActionsMenu
                item={x}
                canSendEmail={canSendEmail}
                canDownloadCompactPdf={canDownloadCompactPdf}
                onSendPublicPdf={onSendPublicPdf}
                onDelete={onDelete}
                onPrint={(id) => printSingle(id, "signed")}
                isPrinting={isPrinting}
                printingId={printingId}
                hideDelete={selectMode}
                showToast={showToast}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CardSkeletons() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={`rounded-[10px] p-4 ${surface} ${subtleShadow}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-[#E5E7EB] animate-pulse" />
              <div className="h-5 w-24 rounded bg-[#E5E7EB] animate-pulse" />
            </div>
            <div className="h-4 w-12 rounded bg-[#E5E7EB] animate-pulse" />
          </div>
          <div className="h-4 w-full rounded bg-[#E5E7EB] animate-pulse mb-1" />
          <div className="h-4 w-3/4 rounded bg-[#E5E7EB] animate-pulse mb-3" />
          <div className="h-3 w-24 rounded bg-[#E5E7EB] animate-pulse mb-3" />
          <div className="flex gap-2">
            <div className="h-8 w-24 rounded-lg bg-[#E5E7EB] animate-pulse" />
            <div className="h-8 w-28 rounded-lg bg-[#E5E7EB] animate-pulse" />
            <div className="h-8 w-8 rounded-lg bg-[#E5E7EB] animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TableSkeletons() {
  return (
    <div className={`overflow-hidden rounded-lg mb-4 ${surface} ${subtleShadow}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
            <tr>
              <th className="px-3 py-2.5 w-10" />
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#64748B] w-16">Nr.</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#64748B]">Document</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#64748B] w-32">Tip</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#64748B] w-28">Data</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#64748B] w-40">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="border-t border-[#E5E7EB]">
                <td className="px-3 py-3" />
                <td className="px-3 py-3"><div className="h-4 w-8 rounded bg-[#E5E7EB] animate-pulse" /></td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-[#E5E7EB] animate-pulse shrink-0" />
                    <div className="h-4 w-48 rounded bg-[#E5E7EB] animate-pulse" />
                  </div>
                </td>
                <td className="px-3 py-3"><div className="h-5 w-24 rounded bg-[#E5E7EB] animate-pulse" /></td>
                <td className="px-3 py-3"><div className="h-4 w-20 rounded bg-[#E5E7EB] animate-pulse" /></td>
                <td className="px-3 py-3"><div className="h-8 w-24 rounded bg-[#E5E7EB] animate-pulse" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TableView({
  items,
  selectMode,
  selected,
  setSelected,
  filters,
  setFilters,
  printSingle,
  isPrinting,
  printingId,
  onDelete,
  canSendEmail,
  canDownloadCompactPdf,
  onSendPublicPdf,
  showToast,
}: {
  items: Bicp[];
  selectMode: boolean;
  selected: Record<string, boolean>;
  setSelected: (m: Record<string, boolean>) => void;
  filters: Filters;
  setFilters: (f: Filters) => void;
  printSingle: (id: string, variant?: "signed" | "public") => void;
  isPrinting: boolean;
  printingId: string | null;
  onDelete: (id: string) => void;
  canSendEmail: boolean;
  canDownloadCompactPdf: boolean;
  onSendPublicPdf: (item: Bicp) => void;
  showToast: (message: string, type?: ToastType, durationMs?: number) => void;
}) {
  const currentPageIds = items.map((x) => x.id);
  const allPageSelected = currentPageIds.length > 0 && currentPageIds.every((id) => selected[id]);
  const togglePage = (val: boolean) => {
    const m = { ...selected };
    currentPageIds.forEach((id) => (m[id] = val));
    setSelected(m);
  };

  const handleSort = (column: string) => {
    if (filters.sortBy === column) {
      setFilters({ ...filters, sortDir: filters.sortDir === "asc" ? "desc" : "asc", page: 1 });
    } else {
      setFilters({ ...filters, sortBy: column as Filters["sortBy"], sortDir: "desc", page: 1 });
    }
  };

  const headerClass = "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-[#64748B]";

  const SortableHeader = ({ column, children, className }: { column: string; children: React.ReactNode; className?: string }) => (
    <th
      className={`${headerClass} cursor-pointer hover:bg-[#F1F5F9] transition-colors ${className || ""}`}
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        {filters.sortBy === column && (
          filters.sortDir === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />
        )}
      </div>
    </th>
  );

  return (
    <div className={`overflow-hidden rounded-lg mb-4 ${surface} ${subtleShadow}`}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
            <tr>
              <th className={`${headerClass} w-10`}>
                {selectMode && (
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={(e) => togglePage(e.target.checked)}
                    className="w-4 h-4 text-[#1D4ED8] border-[#E5E7EB] rounded focus:ring-[#1D4ED8]"
                    aria-label="Selectează pagina"
                  />
                )}
              </th>
              <SortableHeader column="numarComunicat" className="w-16">Nr.</SortableHeader>
              <SortableHeader column="titlu">Document</SortableHeader>
              <SortableHeader column="nume" className="w-36">Tip</SortableHeader>
              <SortableHeader column="data" className="w-28">Data</SortableHeader>
              <th className={`${headerClass} w-44`}>Acțiuni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {items.map((x) => {
              const isSelected = !!selected[x.id];

              const toggleSelection = (e: React.MouseEvent) => {
                const target = e.target as HTMLElement;
                if (selectMode && !target.closest("a, button, input")) {
                  setSelected({ ...selected, [x.id]: !isSelected });
                }
              };

              return (
                <tr
                  key={x.id}
                  className={`group transition-colors ${
                    isSelected ? "bg-[#EFF6FF]" : "hover:bg-[#F8FAFC]"
                  } ${selectMode ? "cursor-pointer" : ""}`}
                  onClick={toggleSelection}
                >
                  <td className="px-3 py-3 w-10 align-middle" onClick={(e) => e.stopPropagation()}>
                    {selectMode && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => setSelected({ ...selected, [x.id]: e.target.checked })}
                        className="w-4 h-4 text-[#1D4ED8] border-[#E5E7EB] rounded focus:ring-[#1D4ED8]"
                        aria-label={`Selectează document ${x.numarComunicat ?? x.numar}`}
                      />
                    )}
                  </td>
                  <td className="px-3 py-3 w-16 align-middle text-sm font-bold text-[#111827]">
                    {x.numarComunicat ?? x.numar}
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText size={15} className="text-[#64748B] shrink-0" />
                      <p className="text-sm font-semibold text-[#111827] truncate">{x.titlu || "Fără titlu"}</p>
                    </div>
                  </td>
                  <td className="px-3 py-3 w-36 align-middle">
                    <DocumentBadge tipDocument={x.nume || x.tip || ""} />
                  </td>
                  <td className="px-3 py-3 w-28 align-middle text-[13px] text-[#64748B] whitespace-nowrap">
                    {formatDate(x)}
                  </td>
                  <td className="px-3 py-3 align-middle w-44" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <div className="hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          className={`${btnSecondary} h-8 w-8 p-0`}
                          onClick={() => copyText("Titlu", x.titlu || "", showToast)}
                          title="Copiază titlu"
                          aria-label="Copiază titlu"
                        >
                          <CopyIcon size={13} />
                        </button>
                        <button
                          type="button"
                          className={`${btnSecondary} h-8 w-8 p-0`}
                          onClick={() => copyText("Conținut", x.comunicat || "", showToast)}
                          title="Copiază conținut"
                          aria-label="Copiază conținut"
                        >
                          <CopyIcon size={13} />
                        </button>
                      </div>
                      <DocumentActionsMenu
                        item={x}
                        canSendEmail={canSendEmail}
                        canDownloadCompactPdf={canDownloadCompactPdf}
                        onSendPublicPdf={onSendPublicPdf}
                        onDelete={onDelete}
                        onPrint={(id) => printSingle(id, "signed")}
                        isPrinting={isPrinting}
                        printingId={printingId}
                        hideDelete={selectMode}
                        compact
                        showToast={showToast}
                      />
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

function openInNewTab(url: string, showToast: (message: string, type?: ToastType, durationMs?: number) => void) {
  try {
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) {
      showToast("Pop-up blocat. Permite pop-up-urile pentru a deschide documentul.", "error");
      return false;
    }
    return true;
  } catch {
    showToast("Nu am putut deschide documentul în alt tab.", "error");
    return false;
  }
}

async function openCompactBicpPdfInNewTab(
  itemId: string,
  judetId: string,
  structuraId: string,
  showToast: (message: string, type?: ToastType, durationMs?: number) => void,
) {
  const { auth } = initFirebase();
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    showToast("Trebuie să fii autentificat.", "error");
    return;
  }
  const previewWin = window.open("about:blank", "_blank");
  if (!previewWin) {
    showToast("Pop-up blocat. Permite pop-up-urile pentru a deschide PDF-ul.", "error");
    return;
  }
  try {
    const url = `/api/comunicate/${encodeURIComponent(itemId)}/pdf?variant=public&compact=1&disposition=inline&judetId=${encodeURIComponent(judetId)}&structuraId=${encodeURIComponent(structuraId)}&debug=1`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) {
      previewWin.close();
      showToast("Sesiune expirată sau neautentificat.", "error");
      return;
    }
    if (res.status === 403) {
      previewWin.close();
      showToast("Nu ai drepturi pentru PDF-ul fără antet (doar admin structură).", "error");
      return;
    }
    if (!res.ok) {
      previewWin.close();
      showToast("Eroare la generarea PDF-ului compact.", "error");
      return;
    }
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    previewWin.location.href = objUrl;
    setTimeout(() => URL.revokeObjectURL(objUrl), 120_000);
    showToast("PDF fără antet deschis în tab nou.", "success", 2200);
  } catch {
    try {
      previewWin.close();
    } catch {}
    showToast("Eroare la generarea PDF-ului compact.", "error");
  }
}

async function copyText(label: string, value: string, showToast: (message: string, type?: ToastType, durationMs?: number) => void) {
  const successMessage = label === "Titlu" ? "Titlul a fost copiat" : label === "Conținut" ? "Conținutul a fost copiat" : `${label} a fost copiat`;

  try {
    const textToCopy = String(value || "").trim();
    if (!textToCopy) {
      showToast(`Nu există conținut de copiat pentru ${label}.`, "error");
      return;
    }

    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(textToCopy);
      showToast(successMessage, "success");
      return;
    }

    const textArea = document.createElement("textarea");
    textArea.value = textToCopy;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.top = "-9999px";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    if (!successful) throw new Error("copy_failed");
    showToast(successMessage, "success");
  } catch {
    showToast(`Eroare la copiere pentru ${label}.`, "error");
  }
}

function DocumentActionsMenu({
  item,
  canSendEmail,
  canDownloadCompactPdf,
  onSendPublicPdf,
  onDelete,
  onPrint,
  isPrinting,
  printingId,
  showToast,
  hideDelete = false,
  compact = false,
}: {
  item: Bicp;
  canSendEmail: boolean;
  canDownloadCompactPdf: boolean;
  onSendPublicPdf: (item: Bicp) => void;
  onDelete: (id: string) => void;
  onPrint: (id: string) => void;
  isPrinting: boolean;
  printingId: string | null;
  showToast: (message: string, type?: ToastType, durationMs?: number) => void;
  hideDelete?: boolean;
  compact?: boolean;
}) {
  const { judetId, structuraId } = getTenantContext();
  const signedPdfUrl = `/api/comunicate/${item.id}/pdf?variant=signed&judetId=${encodeURIComponent(judetId)}&structuraId=${encodeURIComponent(structuraId)}&debug=1`;
  const publicPdfUrl = `/api/comunicate/${item.id}/pdf?variant=public&judetId=${encodeURIComponent(judetId)}&structuraId=${encodeURIComponent(structuraId)}&debug=1`;
  const docxUrl = `/api/comunicate/${item.id}/docx?judetId=${encodeURIComponent(judetId)}&structuraId=${encodeURIComponent(structuraId)}`;
  const editUrl = `/creaza-BICP?id=${item.id}`;
  const isCurrentPrinting = printingId === item.id;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={`inline-flex items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#334155] hover:bg-[#F8FAFC] hover:border-[#CBD5E1] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] ${
          compact ? "h-8 w-8" : "h-9 w-9"
        }`}
        title="Acțiuni document"
        aria-label="Acțiuni document"
      >
        <MoreVertical size={compact ? 14 : 16} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Acțiuni document</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="inline-flex items-center gap-2"
          onClick={() => {
            if (openInNewTab(signedPdfUrl, showToast)) showToast("Se deschide PDF-ul semnat...", "info");
          }}
        >
          <FileDown size={14} /> PDF cu semnături
        </DropdownMenuItem>
        <DropdownMenuItem
          className="inline-flex items-center gap-2"
          onClick={() => {
            if (openInNewTab(publicPdfUrl, showToast)) showToast("Se deschide PDF-ul fără semnături...", "info");
          }}
        >
          <FileText size={14} /> PDF fără semnături
        </DropdownMenuItem>
        {canDownloadCompactPdf && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="inline-flex items-center gap-2"
              onClick={() => {
                showToast("Se pregătește PDF-ul fără antet...", "info");
                void openCompactBicpPdfInNewTab(item.id, judetId, structuraId, showToast);
              }}
            >
              <FileText size={14} /> PDF fără antet
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuItem
          className="inline-flex items-center gap-2"
          onClick={() => {
            if (openInNewTab(docxUrl, showToast)) showToast("Se deschide fișierul DOCX...", "info");
          }}
        >
          <FileText size={14} /> DOCX
        </DropdownMenuItem>
        <DropdownMenuItem
          className="inline-flex items-center gap-2"
          onClick={() => onPrint(item.id)}
          disabled={isPrinting}
        >
          {isCurrentPrinting ? <Loader2 className="animate-spin" size={14} /> : <Printer size={14} />}
          {isCurrentPrinting ? "Se pregătește..." : "Printează"}
        </DropdownMenuItem>
        <DropdownMenuItem className="inline-flex items-center gap-2" onClick={() => { window.location.href = editUrl; }}>
          <Pencil size={14} /> Editează
        </DropdownMenuItem>
        {canSendEmail && (
          <DropdownMenuItem className="inline-flex items-center gap-2" onClick={() => onSendPublicPdf(item)}>
            <Mail size={14} /> Trimite email PDF nesemnat
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="inline-flex items-center gap-2" onClick={() => copyText("Titlu", item.titlu || "", showToast)}>
          <CopyIcon size={14} /> Copiază titlu
        </DropdownMenuItem>
        <DropdownMenuItem className="inline-flex items-center gap-2" onClick={() => copyText("Conținut", item.comunicat || "", showToast)}>
          <CopyIcon size={14} /> Copiază conținut
        </DropdownMenuItem>
        {!hideDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="inline-flex items-center gap-2 text-red-700 hover:bg-red-50" onClick={() => onDelete(item.id)}>
              <Trash2 size={14} /> Șterge document
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Pagination({ total, page, pageSize, onChange, onChangePageSize }: { total: number; page: number; pageSize: number; onChange: (p: number) => void; onChangePageSize: (s: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const btn = (p: number, label?: string) => (
    <button
      type="button"
      key={p + (label || "")}
      onClick={() => onChange(p)}
      className={`${btnBase} min-w-[2.25rem] border ${
        p === page
          ? "bg-[#1D4ED8] text-white border-[#1D4ED8]"
          : "bg-white border-[#E5E7EB] text-[#334155] hover:bg-[#F8FAFC]"
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
    if (page > 4) items.push(<span key="l" className="px-1 text-[#94A3B8]">…</span>);
    const start = Math.max(2, page - 1);
    const end = Math.min(pages - 1, page + 1);
    range(start, end);
    if (page < pages - 3) items.push(<span key="r" className="px-1 text-[#94A3B8]">…</span>);
    items.push(btn(pages));
  }
  return (
    <div className={`rounded-lg p-3 mt-4 ${surface} ${subtleShadow}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 items-center">
          {page > 1 && btn(page - 1, "‹")}
          {pages > 1 && items}
          {page < pages && btn(page + 1, "›")}
          <span className="text-sm text-[#64748B] ml-1">
            Pagina {page} din {pages} • {total} documente
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#64748B]">Pe pagină</span>
          <select
            value={pageSize}
            onChange={(e) => onChangePageSize(Number(e.target.value))}
            className={selectBase}
            aria-label="Număr documente pe pagină"
          >
            {[10, 25, 50, 100].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
