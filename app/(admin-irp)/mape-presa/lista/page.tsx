"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { deleteDoc, doc, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Copy as CopyIcon,
  Edit,
  FileDown,
  FileText,
  Grid2X2,
  MoreVertical,
  RefreshCw,
  Rows2,
  Search,
  Trash2,
  UserRound,
  Users2,
  X,
} from "lucide-react";

import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";
import {
  getPressKitCollection,
  normalizePressKitDoc,
  sortPressKitsByUpdatedAtDesc,
} from "@/app/(admin-irp)/mape-presa/_core/firestore";
import {
  buildDefaultConferenceMaterialTitle,
  type PressKitDoc,
  type PressKitPayload,
} from "@/app/(admin-irp)/mape-presa/_core/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ViewMode = "card" | "table";
type SortKey = "updatedAt" | "conferenceDate" | "contactName" | "journalistsCount";
type SortDirection = "asc" | "desc";

type SortState = {
  key: SortKey;
  direction: SortDirection;
};

type FilterState = {
  search: string;
  dateFrom: string;
  dateTo: string;
  contact: string;
  spokesperson: string;
  intocmit: string;
  minJournalists: string;
};

const VIEW_MODE_STORAGE_KEY = "mapePresaListViewMode";

const defaultFilters: FilterState = {
  search: "",
  dateFrom: "",
  dateTo: "",
  contact: "",
  spokesperson: "",
  intocmit: "",
  minJournalists: "",
};

const textInputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100/70";
const selectInputClass = `${textInputClass} pr-3`;

function asDateLabel(value: any) {
  try {
    if (value?.toDate) {
      const dt = value.toDate();
      return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(
        2,
        "0"
      )}.${dt.getFullYear()} ${String(dt.getHours()).padStart(2, "0")}:${String(
        dt.getMinutes()
      ).padStart(2, "0")}`;
    }
  } catch {}
  return "-";
}

function asTimestampMillis(value: unknown) {
  try {
    if (value && typeof value === "object" && "toMillis" in value) {
      return Number((value as any).toMillis?.() || 0);
    }
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  } catch {}
  return 0;
}

function toConferenceDayMillis(value: string): number | null {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const dmy = raw.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return new Date(year, month - 1, day).getTime();
    }
    return null;
  }

  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    ) {
      return new Date(year, month - 1, day).getTime();
    }
    return null;
  }

  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) {
    const date = new Date(parsed);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }

  return null;
}

function toConferenceLabel(item: PressKitDoc) {
  const date = String(item.conference.date || "").trim() || "Dată necompletată";
  const time = String(item.conference.time || "").trim() || "Ora necompletată";
  return `${date} • ${time}`;
}

function toSearchValue(item: PressKitDoc) {
  return [
    item.conference.date,
    item.conference.time,
    item.conferenceMaterial?.title,
    item.conferenceMaterial?.content,
    item.contact.name,
    item.contact.role,
    item.contact.email,
    item.spokesperson.name,
    item.spokesperson.email,
    item.intocmit.name,
    item.invitationNote,
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
}

function hasActiveFilters(filters: FilterState) {
  return Object.values(filters).some((value) => String(value || "").trim().length > 0);
}

function getSortValue(item: PressKitDoc, key: SortKey): number | string {
  switch (key) {
    case "updatedAt":
      return asTimestampMillis(item.updatedAt) || asTimestampMillis(item.createdAt);
    case "conferenceDate":
      return toConferenceDayMillis(item.conference.date) ?? 0;
    case "contactName":
      return String(item.contact.name || "").toLocaleLowerCase();
    case "journalistsCount":
      return item.journalists.length;
    default:
      return 0;
  }
}

function getInitialSortDirection(key: SortKey): SortDirection {
  if (key === "contactName") return "asc";
  return "desc";
}

function getMaterialTitle(item: PressKitDoc) {
  const value = String(item.conferenceMaterial?.title || "").trim();
  if (value) return value;
  return buildDefaultConferenceMaterialTitle(item.conference.year);
}

function getMaterialContent(item: PressKitDoc) {
  return String(item.conferenceMaterial?.content || "").trim();
}

async function copyText(label: string, value: string) {
  const textToCopy = String(value || "").trim();
  if (!textToCopy) {
    throw new Error(`Nu există conținut de copiat pentru ${label}.`);
  }

  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(textToCopy);
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

  const success = document.execCommand("copy");
  document.body.removeChild(textArea);
  if (!success) {
    throw new Error(`Eroare la copiere pentru ${label}.`);
  }
}

async function downloadPressKitPdf(auth: ReturnType<typeof initFirebase>["auth"], payload: PressKitPayload) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Autentificarea este necesară.");

  const res = await fetch("/api/press-kit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let details = "Nu am putut genera PDF-ul.";
    try {
      const body = await res.json();
      details = body?.error || details;
    } catch {}
    throw new Error(details);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "mapa-de-presa.pdf";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function toPayload(item: PressKitDoc): PressKitPayload {
  return {
    conference: item.conference,
    conferenceMaterial: item.conferenceMaterial,
    contact: item.contact,
    hosts: item.hosts,
    institutionContact: item.institutionContact,
    leadership: item.leadership,
    spokesperson: item.spokesperson,
    journalists: item.journalists,
    intocmit: item.intocmit,
    invitationNote: item.invitationNote,
  };
}

type ListHeaderProps = {
  displayedCount: number;
  totalCount: number;
  viewMode: ViewMode;
  onViewChange: (mode: ViewMode) => void;
  onCreate: () => void;
  onReload: () => void;
  disableActions: boolean;
};

function ListHeader({
  displayedCount,
  totalCount,
  viewMode,
  onViewChange,
  onCreate,
  onReload,
  disableActions,
}: ListHeaderProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-blue-50/70 p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
              <FileText size={18} />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Lista mape de presă
            </h1>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Afișate <span className="font-semibold text-slate-900">{displayedCount}</span> din{" "}
            <span className="font-semibold text-slate-900">{totalCount}</span> documente.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => onViewChange("card")}
              className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium transition ${
                viewMode === "card"
                  ? "bg-blue-600 text-white"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
              aria-label="Afișează în format card"
            >
              <Grid2X2 size={14} />
              Carduri
            </button>
            <button
              type="button"
              onClick={() => onViewChange("table")}
              className={`inline-flex items-center gap-2 border-l border-slate-200 px-3 py-2 text-sm font-medium transition ${
                viewMode === "table"
                  ? "bg-blue-600 text-white"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
              aria-label="Afișează în format tabel"
            >
              <Rows2 size={14} />
              Tabel
            </button>
          </div>

          <button
            type="button"
            onClick={onReload}
            disabled={disableActions}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={14} /> Reîncarcă
          </button>
          <button
            type="button"
            onClick={onCreate}
            disabled={disableActions}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Creează mapă
          </button>
        </div>
      </div>
    </section>
  );
}

type FilterBarProps = {
  filters: FilterState;
  onFilterChange: (patch: Partial<FilterState>) => void;
  onReset: () => void;
  hasActive: boolean;
};

function FilterBar({ filters, onFilterChange, onReset, hasActive }: FilterBarProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
          <Search size={15} className="text-slate-500" />
          Filtre rapide
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={!hasActive}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X size={13} /> Reset filtre
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Căutare
          </span>
          <input
            value={filters.search}
            onChange={(event) => onFilterChange({ search: event.target.value })}
            className={textInputClass}
            placeholder="Dată, contact, purtător, întocmit..."
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Contact
          </span>
          <input
            value={filters.contact}
            onChange={(event) => onFilterChange({ contact: event.target.value })}
            className={textInputClass}
            placeholder="Nume sau funcție contact"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Purtător de cuvânt
          </span>
          <input
            value={filters.spokesperson}
            onChange={(event) => onFilterChange({ spokesperson: event.target.value })}
            className={textInputClass}
            placeholder="Nume purtător"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Întocmit
          </span>
          <input
            value={filters.intocmit}
            onChange={(event) => onFilterChange({ intocmit: event.target.value })}
            className={textInputClass}
            placeholder="Nume întocmit"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Dată conferință de la
          </span>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(event) => onFilterChange({ dateFrom: event.target.value })}
            className={selectInputClass}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Dată conferință până la
          </span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(event) => onFilterChange({ dateTo: event.target.value })}
            className={selectInputClass}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
            Nr. minim jurnaliști
          </span>
          <input
            type="number"
            min={0}
            value={filters.minJournalists}
            onChange={(event) => onFilterChange({ minJournalists: event.target.value })}
            className={selectInputClass}
            placeholder="0"
          />
        </label>
      </div>
    </section>
  );
}

type PressKitCardProps = {
  item: PressKitDoc;
  actionId: string | null;
  onEdit: (item: PressKitDoc) => void;
  onDownload: (item: PressKitDoc) => void;
  onDelete: (item: PressKitDoc) => void;
  onCopyTitle: (item: PressKitDoc) => void;
  onCopyContent: (item: PressKitDoc) => void;
};

function PressKitCard({
  item,
  actionId,
  onEdit,
  onDownload,
  onDelete,
  onCopyTitle,
  onCopyContent,
}: PressKitCardProps) {
  const busy = actionId === item.id;
  const conferenceDate = String(item.conference.date || "").trim() || "Dată necompletată";
  const conferenceTime = String(item.conference.time || "").trim() || "Ora necompletată";
  const materialTitle = getMaterialTitle(item);
  const contactName = String(item.contact.name || "").trim() || "Contact necompletat";
  const spokesperson = String(item.spokesperson.name || "").trim() || "Purtător necompletat";
  const intocmit = String(item.intocmit.name || "").trim() || "Întocmit necompletat";

  return (
    <article className="group relative rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-lg">
      <div className="absolute right-4 top-4 md:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              aria-label={`Acțiuni pentru mapa ${conferenceDate}`}
            >
              <MoreVertical size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acțiuni</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onEdit(item)} disabled={busy}>
              <span className="inline-flex items-center gap-2">
                <Edit size={14} /> Edit
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDownload(item)} disabled={busy}>
              <span className="inline-flex items-center gap-2">
                <FileDown size={14} /> PDF
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onCopyTitle(item)} disabled={busy}>
              <span className="inline-flex items-center gap-2">
                <CopyIcon size={14} /> Copiază titlu
              </span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCopyContent(item)} disabled={busy}>
              <span className="inline-flex items-center gap-2">
                <CopyIcon size={14} /> Copiază conținut
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(item)}
              disabled={busy}
              className="text-red-700 hover:bg-red-50"
            >
              <span className="inline-flex items-center gap-2">
                <Trash2 size={14} /> Șterge
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center gap-2 pr-12 md:pr-0">
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
          <CalendarClock size={12} />
          {conferenceDate}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
          {conferenceTime}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
          <Users2 size={12} />
          {item.journalists.length} jurnaliști
        </span>
      </div>

      <div className="mt-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Titlu material conferință
        </div>
        <div className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-slate-900">
          {materialTitle}
        </div>
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</div>
          <div className="font-medium text-slate-900">{contactName}</div>
          <div className="text-slate-600">{String(item.contact.role || "").trim() || "Funcție necompletată"}</div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Purtător de cuvânt
            </div>
            <div className="inline-flex items-center gap-1 text-slate-900">
              <UserRound size={13} className="text-slate-500" />
              {spokesperson}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Întocmit</div>
            <div className="text-slate-900">{intocmit}</div>
          </div>
        </div>
      </div>

      <div className="mt-5 text-xs text-slate-500">
        Actualizat: {asDateLabel(item.updatedAt || item.createdAt)}
      </div>

      <div className="mt-4 hidden items-center gap-2 md:flex">
        <button
          type="button"
          onClick={() => onCopyTitle(item)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          title="Copiază titlu"
          aria-label="Copiază titlu"
        >
          <CopyIcon size={13} />
          Titlu
        </button>
        <button
          type="button"
          onClick={() => onCopyContent(item)}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          title="Copiază conținut"
          aria-label="Copiază conținut"
        >
          <CopyIcon size={13} />
          Conținut
        </button>
        <button
          type="button"
          onClick={() => onEdit(item)}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Edit size={14} /> Edit
        </button>
        <button
          type="button"
          onClick={() => onDownload(item)}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FileDown size={14} /> PDF
        </button>
        <button
          type="button"
          onClick={() => onDelete(item)}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 size={14} /> Șterge
        </button>
      </div>
    </article>
  );
}

type SortHeaderButtonProps = {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onToggle: (key: SortKey) => void;
  className?: string;
};

function SortHeaderButton({ label, sortKey, sort, onToggle, className = "" }: SortHeaderButtonProps) {
  const isActive = sort.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onToggle(sortKey)}
      className={`inline-flex items-center gap-1 rounded px-1.5 py-1 text-left text-sm font-semibold transition ${
        isActive ? "text-blue-700" : "text-slate-700 hover:text-slate-900"
      } ${className}`}
      aria-label={`Sortează după ${label}`}
    >
      <span>{label}</span>
      {isActive ? (
        sort.direction === "asc" ? (
          <ChevronUp size={14} />
        ) : (
          <ChevronDown size={14} />
        )
      ) : (
        <ChevronDown size={14} className="opacity-30" />
      )}
    </button>
  );
}

type PressKitTableProps = {
  items: PressKitDoc[];
  sort: SortState;
  onSortChange: (key: SortKey) => void;
  actionId: string | null;
  onEdit: (item: PressKitDoc) => void;
  onDownload: (item: PressKitDoc) => void;
  onDelete: (item: PressKitDoc) => void;
  onCopyTitle: (item: PressKitDoc) => void;
  onCopyContent: (item: PressKitDoc) => void;
};

function PressKitTable({
  items,
  sort,
  onSortChange,
  actionId,
  onEdit,
  onDownload,
  onDelete,
  onCopyTitle,
  onCopyContent,
}: PressKitTableProps) {
  return (
    <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-[980px] w-full">
        <thead className="sticky top-0 z-10 bg-slate-50">
          <tr className="border-b border-slate-200">
            <th className="p-3 text-left">
              <SortHeaderButton
                label="Conferință"
                sortKey="conferenceDate"
                sort={sort}
                onToggle={onSortChange}
              />
            </th>
            <th className="p-3 text-left">
              <SortHeaderButton
                label="Contact"
                sortKey="contactName"
                sort={sort}
                onToggle={onSortChange}
              />
            </th>
            <th className="p-3 text-left text-sm font-semibold text-slate-700">Purtător</th>
            <th className="p-3 text-left text-sm font-semibold text-slate-700">Întocmit</th>
            <th className="p-3 text-left">
              <SortHeaderButton
                label="Jurnaliști"
                sortKey="journalistsCount"
                sort={sort}
                onToggle={onSortChange}
              />
            </th>
            <th className="p-3 text-left">
              <SortHeaderButton
                label="Actualizat"
                sortKey="updatedAt"
                sort={sort}
                onToggle={onSortChange}
              />
            </th>
            <th className="p-3 text-right text-sm font-semibold text-slate-700">Acțiuni</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item, index) => {
            const busy = actionId === item.id;
            return (
              <tr
                key={item.id}
                className={`transition hover:bg-blue-50/40 ${
                  index % 2 === 0 ? "bg-white" : "bg-slate-50/35"
                }`}
              >
                <td className="p-3 text-sm text-slate-800">
                  <div className="font-medium text-slate-900">{item.conference.date || "-"}</div>
                  <div className="text-slate-600">Ora {item.conference.time || "-"}</div>
                  <div className="mt-1 line-clamp-1 text-xs text-slate-600">{getMaterialTitle(item)}</div>
                </td>
                <td className="p-3 text-sm">
                  <div className="font-medium text-slate-900">{item.contact.name || "-"}</div>
                  <div className="text-slate-600">{item.contact.role || "-"}</div>
                </td>
                <td className="p-3 text-sm text-slate-700">{item.spokesperson.name || "-"}</td>
                <td className="p-3 text-sm text-slate-700">{item.intocmit.name || "-"}</td>
                <td className="p-3 text-sm text-slate-700">
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    <Users2 size={12} />
                    {item.journalists.length}
                  </span>
                </td>
                <td className="p-3 text-sm text-slate-700">{asDateLabel(item.updatedAt || item.createdAt)}</td>
                <td className="p-3">
                  <div className="hidden justify-end gap-2 md:flex">
                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Edit size={14} /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDownload(item)}
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FileDown size={14} /> PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => onCopyTitle(item)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      title="Copiază titlu"
                      aria-label="Copiază titlu"
                    >
                      <CopyIcon size={13} />
                      Titlu
                    </button>
                    <button
                      type="button"
                      onClick={() => onCopyContent(item)}
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      title="Copiază conținut"
                      aria-label="Copiază conținut"
                    >
                      <CopyIcon size={13} />
                      Conținut
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(item)}
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Trash2 size={14} /> Șterge
                    </button>
                  </div>

                  <div className="flex justify-end md:hidden">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          aria-label={`Acțiuni pentru mapa ${toConferenceLabel(item)}`}
                        >
                          <MoreVertical size={16} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Acțiuni</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onEdit(item)} disabled={busy}>
                          <span className="inline-flex items-center gap-2">
                            <Edit size={14} /> Edit
                          </span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDownload(item)} disabled={busy}>
                          <span className="inline-flex items-center gap-2">
                            <FileDown size={14} /> PDF
                          </span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onCopyTitle(item)} disabled={busy}>
                          <span className="inline-flex items-center gap-2">
                            <CopyIcon size={14} /> Copiază titlu
                          </span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onCopyContent(item)} disabled={busy}>
                          <span className="inline-flex items-center gap-2">
                            <CopyIcon size={14} /> Copiază conținut
                          </span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDelete(item)}
                          disabled={busy}
                          className="text-red-700 hover:bg-red-50"
                        >
                          <span className="inline-flex items-center gap-2">
                            <Trash2 size={14} /> Șterge
                          </span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

type EmptyStateProps = {
  hasFilters: boolean;
  onCreate: () => void;
  onReset: () => void;
};

function EmptyState({ hasFilters, onCreate, onReset }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
      <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <FileText size={24} />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-900">
        {hasFilters ? "Nu există rezultate pentru filtrele curente" : "Nu există încă mape de presă"}
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        {hasFilters
          ? "Resetează filtrele sau ajustează criteriile de căutare."
          : "Creează prima mapă de presă pentru a începe evidența documentelor."}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {hasFilters ? (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            <X size={14} /> Reset filtre
          </button>
        ) : null}
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Creează mapă
        </button>
      </div>
    </div>
  );
}

function LoadingState({ viewMode }: { viewMode: ViewMode }) {
  if (viewMode === "table") {
    return (
      <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[980px] w-full">
          <thead className="bg-slate-50">
            <tr>
              {["Conferință", "Contact", "Purtător", "Întocmit", "Jurnaliști", "Actualizat", "Acțiuni"].map(
                (label) => (
                  <th key={label} className="p-3 text-left text-sm font-semibold text-slate-600">
                    {label}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Array.from({ length: 6 }).map((_, index) => (
              <tr key={index}>
                {Array.from({ length: 7 }).map((__, cellIndex) => (
                  <td key={`${index}-${cellIndex}`} className="p-3">
                    <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="h-6 w-44 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 h-4 w-full animate-pulse rounded bg-slate-200" />
          <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 h-4 w-3/5 animate-pulse rounded bg-slate-200" />
          <div className="mt-5 h-9 w-full animate-pulse rounded-xl bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

type DeleteConfirmDialogProps = {
  item: PressKitDoc | null;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

function DeleteConfirmDialog({ item, isSubmitting, onClose, onConfirm }: DeleteConfirmDialogProps) {
  const open = Boolean(item);
  const label = item ? toConferenceLabel(item) : "";

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isSubmitting) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmă ștergerea</DialogTitle>
          <DialogDescription>
            {item
              ? `Vrei să ștergi definitiv mapa de presă „${label}”?`
              : "Vrei să ștergi definitiv această mapă de presă?"}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Renunță
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Se șterge..." : "Șterge"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ListaMapePresaPage() {
  const { db, auth } = initFirebase();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PressKitDoc[]>([]);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [sort, setSort] = useState<SortState>({
    key: "updatedAt",
    direction: "desc",
  });
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PressKitDoc | null>(null);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { judetId, structuraId } = getTenantContext();
      const collectionRef = getPressKitCollection(db, judetId, structuraId);
      const snap = await getDocs(collectionRef);
      const normalized = snap.docs.map((entry) => normalizePressKitDoc(entry.data(), entry.id));
      setItems(sortPressKitsByUpdatedAtDesc(normalized));
    } catch {
      setError("Eroare la încărcarea listelor de mape de presă.");
    } finally {
      setLoading(false);
      setActionId(null);
    }
  }, [db]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    if (saved === "card" || saved === "table") {
      setViewMode(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  const activeFilters = useMemo(() => hasActiveFilters(filters), [filters]);

  const filteredAndSorted = useMemo(() => {
    const searchTerm = filters.search.trim().toLowerCase();
    const contactTerm = filters.contact.trim().toLowerCase();
    const spokespersonTerm = filters.spokesperson.trim().toLowerCase();
    const intocmitTerm = filters.intocmit.trim().toLowerCase();
    const fromMillis = filters.dateFrom ? toConferenceDayMillis(filters.dateFrom) : null;
    const toMillis = filters.dateTo ? toConferenceDayMillis(filters.dateTo) : null;
    const minJournalistsRaw = Number.parseInt(filters.minJournalists, 10);
    const minJournalists =
      Number.isFinite(minJournalistsRaw) && minJournalistsRaw > 0 ? minJournalistsRaw : 0;

    const filtered = items.filter((item) => {
      if (searchTerm && !toSearchValue(item).includes(searchTerm)) return false;

      if (contactTerm) {
        const contactValue = `${item.contact.name} ${item.contact.role}`.toLowerCase();
        if (!contactValue.includes(contactTerm)) return false;
      }

      if (spokespersonTerm) {
        if (!String(item.spokesperson.name || "").toLowerCase().includes(spokespersonTerm)) {
          return false;
        }
      }

      if (intocmitTerm) {
        if (!String(item.intocmit.name || "").toLowerCase().includes(intocmitTerm)) {
          return false;
        }
      }

      if (minJournalists > 0 && item.journalists.length < minJournalists) return false;

      if (fromMillis !== null || toMillis !== null) {
        const conferenceMillis = toConferenceDayMillis(item.conference.date);
        if (conferenceMillis === null) return false;
        if (fromMillis !== null && conferenceMillis < fromMillis) return false;
        if (toMillis !== null && conferenceMillis > toMillis) return false;
      }

      return true;
    });

    const sorted = [...filtered].sort((left, right) => {
      const leftValue = getSortValue(left, sort.key);
      const rightValue = getSortValue(right, sort.key);

      if (typeof leftValue === "string" || typeof rightValue === "string") {
        const result = String(leftValue).localeCompare(String(rightValue), "ro", {
          sensitivity: "base",
        });
        return sort.direction === "asc" ? result : -result;
      }

      const result = Number(leftValue) - Number(rightValue);
      return sort.direction === "asc" ? result : -result;
    });

    return sorted;
  }, [filters, items, sort]);

  function handleFilterChange(patch: Partial<FilterState>) {
    setFilters((previous) => ({ ...previous, ...patch }));
  }

  function handleResetFilters() {
    setFilters(defaultFilters);
  }

  function handleToggleSort(key: SortKey) {
    setSort((previous) => {
      if (previous.key === key) {
        return {
          key,
          direction: previous.direction === "asc" ? "desc" : "asc",
        };
      }
      return {
        key,
        direction: getInitialSortDirection(key),
      };
    });
  }

  function handleEdit(item: PressKitDoc) {
    router.push(`/mape-presa/creeaza?id=${encodeURIComponent(item.id)}`);
  }

  function handleAskDelete(item: PressKitDoc) {
    setDeleteTarget(item);
  }

  async function handleDeleteConfirmed() {
    if (!deleteTarget) return;

    setActionId(deleteTarget.id);
    setError(null);
    try {
      const { judetId, structuraId } = getTenantContext();
      const collectionRef = getPressKitCollection(db, judetId, structuraId);
      await deleteDoc(doc(collectionRef, deleteTarget.id));
      setDeleteTarget(null);
      await loadItems();
    } catch {
      setError("Nu am putut șterge documentul.");
      setActionId(null);
    }
  }

  async function handleDownload(item: PressKitDoc) {
    setActionId(item.id);
    setError(null);
    try {
      await downloadPressKitPdf(auth, toPayload(item));
    } catch (err: any) {
      setError(err?.message || "Eroare la generarea PDF-ului.");
    } finally {
      setActionId(null);
    }
  }

  async function handleCopyTitle(item: PressKitDoc) {
    setError(null);
    try {
      await copyText("Titlu", getMaterialTitle(item));
    } catch (err: any) {
      setError(err?.message || "Eroare la copiere pentru titlu.");
    }
  }

  async function handleCopyContent(item: PressKitDoc) {
    setError(null);
    try {
      await copyText("Conținut", getMaterialContent(item));
    } catch (err: any) {
      setError(err?.message || "Eroare la copiere pentru conținut.");
    }
  }

  return (
    <div className="space-y-6">
      <ListHeader
        displayedCount={filteredAndSorted.length}
        totalCount={items.length}
        viewMode={viewMode}
        onViewChange={setViewMode}
        onCreate={() => router.push("/mape-presa/creeaza")}
        onReload={() => void loadItems()}
        disableActions={loading}
      />

      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
        hasActive={activeFilters}
      />

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? <LoadingState viewMode={viewMode} /> : null}

      {!loading && filteredAndSorted.length === 0 ? (
        <EmptyState
          hasFilters={activeFilters}
          onCreate={() => router.push("/mape-presa/creeaza")}
          onReset={handleResetFilters}
        />
      ) : null}

      {!loading && filteredAndSorted.length > 0 && viewMode === "card" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredAndSorted.map((item) => (
            <PressKitCard
              key={item.id}
              item={item}
              actionId={actionId}
              onEdit={handleEdit}
              onDownload={(row) => void handleDownload(row)}
              onDelete={handleAskDelete}
              onCopyTitle={(row) => void handleCopyTitle(row)}
              onCopyContent={(row) => void handleCopyContent(row)}
            />
          ))}
        </div>
      ) : null}

      {!loading && filteredAndSorted.length > 0 && viewMode === "table" ? (
        <PressKitTable
          items={filteredAndSorted}
          sort={sort}
          onSortChange={handleToggleSort}
          actionId={actionId}
          onEdit={handleEdit}
          onDownload={(row) => void handleDownload(row)}
          onDelete={handleAskDelete}
          onCopyTitle={(row) => void handleCopyTitle(row)}
          onCopyContent={(row) => void handleCopyContent(row)}
        />
      ) : null}

      <DeleteConfirmDialog
        item={deleteTarget}
        isSubmitting={deleteTarget ? actionId === deleteTarget.id : false}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteConfirmed()}
      />
    </div>
  );
}
