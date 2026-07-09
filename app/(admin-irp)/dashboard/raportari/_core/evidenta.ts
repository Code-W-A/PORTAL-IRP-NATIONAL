import { getOrderedColumns } from "@/app/(admin-irp)/dashboard/raportari/_core/export";
import {
  formatRowDateCellDisplay,
  getRowDateBounds,
  getRowDateSortKey,
} from "@/app/(admin-irp)/dashboard/raportari/_core/rowDateCell";
import { formatPeriodRangeLabel } from "@/app/(admin-irp)/dashboard/raportari/_core/title";
import type { ReportInstanceDoc, ReportRowDoc, ReportTypeColumn } from "@/app/(admin-irp)/dashboard/raportari/_core/types";

export type EvidentaRowEntry = {
  reportId: string;
  reportTitle: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  registrationNumber: string;
  rowIndex: number;
  row: ReportRowDoc;
  columns: ReportTypeColumn[];
};

export type EvidentaReportGroup = {
  reportId: string;
  reportTitle: string;
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
  registrationNumber: string;
  columns: ReportTypeColumn[];
  rows: Array<{ rowIndex: number; row: ReportRowDoc }>;
};

export type EvidentaDateFilters = {
  reportFrom?: string;
  reportTo?: string;
  rowFrom?: string;
  rowTo?: string;
};

function compareReportsByPeriod(a: ReportInstanceDoc, b: ReportInstanceDoc) {
  if (a.periodStart !== b.periodStart) {
    return b.periodStart.localeCompare(a.periodStart);
  }
  if (a.periodEnd !== b.periodEnd) {
    return b.periodEnd.localeCompare(a.periodEnd);
  }
  return b.id.localeCompare(a.id);
}

export function buildEvidentaRows(reports: ReportInstanceDoc[], typeId: string): EvidentaRowEntry[] {
  const entries: EvidentaRowEntry[] = [];

  for (const report of reports.filter((item) => item.typeId === typeId).sort(compareReportsByPeriod)) {
    const periodLabel = formatPeriodRangeLabel(report.periodStart, report.periodEnd);
    const columns = getOrderedColumns(report.columnsSnapshot);

    report.rows.forEach((row, rowIndex) => {
      entries.push({
        reportId: report.id,
        reportTitle: report.title,
        periodStart: report.periodStart,
        periodEnd: report.periodEnd,
        periodLabel,
        registrationNumber: report.registrationNumber,
        rowIndex,
        row,
        columns,
      });
    });
  }

  return entries;
}

function formatCellForSearch(column: ReportTypeColumn, value: string) {
  if (column.kind === "date_flexible" || column.id === "data") {
    return formatRowDateCellDisplay(value);
  }
  return value;
}

function entrySearchText(entry: EvidentaRowEntry) {
  const rowValues = entry.columns
    .map((column) => formatCellForSearch(column, String(entry.row.cells[column.id] || "")))
    .join(" ");
  return [
    entry.reportTitle,
    entry.periodLabel,
    entry.periodStart,
    entry.periodEnd,
    entry.registrationNumber,
    rowValues,
  ]
    .join(" ")
    .toLowerCase();
}

export function filterEvidentaRows(entries: EvidentaRowEntry[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return entries;
  return entries.filter((entry) => entrySearchText(entry).includes(normalized));
}

function overlapsRange(
  start: string | null,
  end: string | null,
  filterFrom?: string,
  filterTo?: string
) {
  if (!filterFrom && !filterTo) return true;
  if (!start || !end) return !filterFrom && !filterTo;

  const rangeStart = start;
  const rangeEnd = end;
  if (filterFrom && rangeEnd < filterFrom) return false;
  if (filterTo && rangeStart > filterTo) return false;
  return true;
}

export function filterEvidentaRowsByDate(
  entries: EvidentaRowEntry[],
  filters: EvidentaDateFilters
) {
  const { reportFrom, reportTo, rowFrom, rowTo } = filters;
  if (!reportFrom && !reportTo && !rowFrom && !rowTo) return entries;

  return entries.filter((entry) => {
    if (!overlapsRange(entry.periodStart, entry.periodEnd, reportFrom, reportTo)) {
      return false;
    }

    const dataColumn = entry.columns.find((column) => column.id === "data");
    const rawDate = dataColumn ? String(entry.row.cells[dataColumn.id] || "") : "";
    const bounds = getRowDateBounds(rawDate);
    return overlapsRange(bounds.start, bounds.end, rowFrom, rowTo);
  });
}

export function groupEvidentaRows(entries: EvidentaRowEntry[]): EvidentaReportGroup[] {
  const groups = new Map<string, EvidentaReportGroup>();

  for (const entry of entries) {
    const existing = groups.get(entry.reportId);
    if (!existing) {
      groups.set(entry.reportId, {
        reportId: entry.reportId,
        reportTitle: entry.reportTitle,
        periodStart: entry.periodStart,
        periodEnd: entry.periodEnd,
        periodLabel: entry.periodLabel,
        registrationNumber: entry.registrationNumber,
        columns: entry.columns,
        rows: [{ rowIndex: entry.rowIndex, row: entry.row }],
      });
      continue;
    }

    existing.rows.push({ rowIndex: entry.rowIndex, row: entry.row });
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      rows: [...group.rows].sort((a, b) => {
        const dataColumn = group.columns.find((column) => column.id === "data");
        const aValue = dataColumn ? String(a.row.cells[dataColumn.id] || "") : "";
        const bValue = dataColumn ? String(b.row.cells[dataColumn.id] || "") : "";
        return getRowDateSortKey(aValue).localeCompare(getRowDateSortKey(bValue));
      }),
    }))
    .sort((a, b) => {
      if (a.periodStart !== b.periodStart) {
        return b.periodStart.localeCompare(a.periodStart);
      }
      return b.periodEnd.localeCompare(a.periodEnd);
    });
}

export function shortColumnLabel(label: string) {
  if (label === "Unitatea") return "Unitatea";
  if (label === "Data") return "Data";
  if (label.startsWith("Activitatea")) return "Activitate";
  if (label.startsWith("Modalitatea")) return "Modalitate";
  if (label.startsWith("Persoanele")) return "Persoane";
  if (label === "Observații") return "Observații";
  return label.length > 24 ? `${label.slice(0, 24)}…` : label;
}

export function formatEvidentaCellValue(column: ReportTypeColumn, value: string) {
  if (column.kind === "date_flexible" || column.id === "data") {
    return formatRowDateCellDisplay(value);
  }
  return value;
}
