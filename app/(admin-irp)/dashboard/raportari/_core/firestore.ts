import { collection, doc, type Firestore } from "firebase/firestore";

import type { ReportColumnKind, ReportColumnWidth, ReportInstanceDoc, ReportRowDoc, ReportTypeColumn, ReportTypeDoc } from "./types";
import { getTenantContext } from "@/lib/tenant";

function asWidth(value: unknown): ReportColumnWidth {
  return value === "s" || value === "m" || value === "l" ? value : "m";
}

function asKind(value: unknown): ReportColumnKind {
  return value === "text" || value === "textarea" ? value : "text";
}

export function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function createColumnId(label: string) {
  const base = slugify(label) || "col";
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

export function sortColumns(columns: ReportTypeColumn[]) {
  return [...columns].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.label.localeCompare(b.label, "ro");
  });
}

export function getTenantDocRef(db: Firestore) {
  const { judetId, structuraId } = getTenantContext();
  return doc(db, `Judete/${judetId}/Structuri/${structuraId}`);
}

export function getReportTypesCollection(db: Firestore) {
  return collection(getTenantDocRef(db), "RaportariTipuri");
}

export function getReportsCollection(db: Firestore) {
  return collection(getTenantDocRef(db), "Raportari");
}

export function normalizeTypeDoc(raw: any, id: string): ReportTypeDoc {
  const columnsRaw = Array.isArray(raw?.columns) ? raw.columns : [];
  const columns = columnsRaw.map((column: any, index: number): ReportTypeColumn => {
    const label = String(column?.label || `Coloană ${index + 1}`);
    return {
      id: String(column?.id || createColumnId(label)),
      label,
      kind: asKind(column?.kind),
      width: asWidth(column?.width),
      required: Boolean(column?.required),
      order: Number.isFinite(column?.order) ? Number(column.order) : index,
    };
  });

  return {
    id,
    name: String(raw?.name || "Tip raport"),
    description: String(raw?.description || ""),
    columns: sortColumns(columns),
    archived: Boolean(raw?.archived),
    createdAt: raw?.createdAt,
    updatedAt: raw?.updatedAt,
  };
}

function normalizeRow(raw: any, columns: ReportTypeColumn[]): ReportRowDoc {
  const cellsRaw = raw?.cells && typeof raw.cells === "object" ? raw.cells : {};
  const cells: Record<string, string> = {};
  columns.forEach((column) => {
    cells[column.id] = String(cellsRaw[column.id] || "");
  });
  return {
    id: String(raw?.id || createId()),
    cells,
  };
}

export function normalizeReportDoc(raw: any, id: string): ReportInstanceDoc {
  const columnsRaw = Array.isArray(raw?.columnsSnapshot) ? raw.columnsSnapshot : [];
  const columns = sortColumns(
    columnsRaw.map((column: any, index: number): ReportTypeColumn => ({
      id: String(column?.id || createColumnId(column?.label || `Coloană ${index + 1}`)),
      label: String(column?.label || `Coloană ${index + 1}`),
      kind: asKind(column?.kind),
      width: asWidth(column?.width),
      required: Boolean(column?.required),
      order: Number.isFinite(column?.order) ? Number(column.order) : index,
    }))
  );

  const rowsRaw = Array.isArray(raw?.rows) ? raw.rows : [];
  return {
    id,
    typeId: String(raw?.typeId || ""),
    typeNameSnapshot: String(raw?.typeNameSnapshot || ""),
    typeDescriptionSnapshot: String(raw?.typeDescriptionSnapshot || ""),
    columnsSnapshot: columns,
    title: String(raw?.title || "Raport"),
    registrationNumber: String(raw?.registrationNumber || ""),
    periodPreset:
      raw?.periodPreset === "previous_month" || raw?.periodPreset === "previous_year"
        ? raw.periodPreset
        : "custom",
    periodStart: String(raw?.periodStart || ""),
    periodEnd: String(raw?.periodEnd || ""),
    rows: rowsRaw.map((row: any) => normalizeRow(row, columns)),
    createdAt: raw?.createdAt,
    updatedAt: raw?.updatedAt,
  };
}
