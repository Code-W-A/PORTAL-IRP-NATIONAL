import { differenceInCalendarDays, parseISO } from "date-fns";

import { getOrderedColumns } from "@/app/(admin-irp)/dashboard/raportari/_core/export";
import type { PeriodRange } from "@/app/(admin-irp)/dashboard/raportari/_core/period";
import {
  getDefaultImpactRowCells,
  ACTIVITATI_IMPACT_TYPE_ID,
} from "@/app/(admin-irp)/dashboard/raportari/_core/templates/activitatiImpact";
import {
  DEFAULT_UNITATE_LABEL,
  getDefaultIntentiiRowCells,
  INTENTII_MEDIATIZARE_TYPE_ID,
} from "@/app/(admin-irp)/dashboard/raportari/_core/templates/intentiiMediatizare";
import {
  getRowDateBounds,
  isGenericPeriodData,
  shiftRowDateCellByDays,
} from "@/app/(admin-irp)/dashboard/raportari/_core/rowDateCell";
import type { ReportInstanceDoc, ReportRowDoc } from "@/app/(admin-irp)/dashboard/raportari/_core/types";

function cloneRow(row: ReportRowDoc): ReportRowDoc {
  return {
    id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    cells: { ...row.cells },
  };
}

function getPeriodShiftDays(fromPeriod: PeriodRange, toPeriod: PeriodRange): number | null {
  try {
    const fromStart = parseISO(fromPeriod.start);
    const toStart = parseISO(toPeriod.start);
    return differenceInCalendarDays(toStart, fromStart);
  } catch {
    return null;
  }
}

export function getDefaultRowCellsForType(
  typeId: string,
  options?: {
    unitate?: string;
    dataLabel?: string;
    dataIso?: string;
    persoane?: string;
  }
): Record<string, string> {
  if (typeId === ACTIVITATI_IMPACT_TYPE_ID) {
    return getDefaultImpactRowCells({
      unitate: options?.unitate,
      dataLabel: options?.dataLabel,
      dataIso: options?.dataIso,
    });
  }

  return getDefaultIntentiiRowCells({
    unitate: options?.unitate,
    dataLabel: options?.dataLabel,
    dataIso: options?.dataIso,
    persoane: options?.persoane,
  });
}

export function shiftRowsDatesByDays(rows: ReportRowDoc[], days: number): ReportRowDoc[] {
  if (!days) return rows;
  return rows.map((row) => ({
    ...row,
    cells: {
      ...row.cells,
      data: shiftRowDateCellByDays(String(row.cells.data || ""), days),
    },
  }));
}

export function suggestRowsFromHistory(
  lastReport: ReportInstanceDoc | null,
  newPeriod: PeriodRange,
  options?: { typeId?: string; unitate?: string; persoane?: string }
): ReportRowDoc[] {
  const typeId = options?.typeId || lastReport?.typeId || INTENTII_MEDIATIZARE_TYPE_ID;
  const defaultCells = getDefaultRowCellsForType(typeId, {
    unitate: options?.unitate || DEFAULT_UNITATE_LABEL,
    dataIso: newPeriod.start,
    persoane: options?.persoane,
  });

  if (!lastReport?.rows?.length) {
    return [
      {
        id: `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
        cells: defaultCells,
      },
    ];
  }

  const shiftDays = getPeriodShiftDays(
    { start: lastReport.periodStart, end: lastReport.periodEnd },
    newPeriod
  );

  return lastReport.rows.map((row) => {
    const next = cloneRow(row);
    const dataValue = String(next.cells.data || "").trim();

    if (shiftDays && getRowDateBounds(dataValue).start) {
      next.cells.data = shiftRowDateCellByDays(dataValue, shiftDays);
    } else if (isGenericPeriodData(dataValue)) {
      next.cells.data = newPeriod.start;
    }

    if (!String(next.cells.unitate || "").trim()) {
      next.cells.unitate = options?.unitate || DEFAULT_UNITATE_LABEL;
    }
    if (
      typeId === INTENTII_MEDIATIZARE_TYPE_ID &&
      !String(next.cells.persoane || "").trim() &&
      options?.persoane
    ) {
      next.cells.persoane = options.persoane;
    }
    return next;
  });
}

export function suggestCellValues(
  columnId: string,
  historyReports: ReportInstanceDoc[],
  limit = 5
): string[] {
  const counts = new Map<string, number>();

  for (const report of historyReports) {
    for (const row of report.rows) {
      const value = String(row.cells[columnId] || "").trim();
      if (!value) continue;
      counts.set(value, (counts.get(value) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ro"))
    .slice(0, limit)
    .map(([value]) => value);
}

export function getLastReportForType(
  reports: ReportInstanceDoc[],
  typeId: string
): ReportInstanceDoc | null {
  const filtered = reports.filter((report) => report.typeId === typeId);
  if (!filtered.length) return null;

  return [...filtered].sort((a, b) => {
    if (a.periodEnd !== b.periodEnd) {
      return b.periodEnd.localeCompare(a.periodEnd);
    }
    if (a.periodStart !== b.periodStart) {
      return b.periodStart.localeCompare(a.periodStart);
    }
    return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
  })[0];
}

type ReportAutocompleteSource = Pick<ReportInstanceDoc, "columnsSnapshot" | "typeId">;

export function buildAutocompleteMap(
  report: ReportAutocompleteSource | null,
  historyReports: ReportInstanceDoc[]
) {
  const columns = report ? getOrderedColumns(report.columnsSnapshot) : [];
  const relevantHistory = historyReports.filter((item) => item.typeId === report?.typeId).slice(0, 8);
  const map: Record<string, string[]> = {};

  for (const column of columns) {
    if (column.kind === "date_flexible") continue;
    map[column.id] = suggestCellValues(column.id, relevantHistory);
  }

  return map;
}

export function suggestCompletionsForRows(
  rows: ReportRowDoc[],
  columns: ReportInstanceDoc["columnsSnapshot"],
  historyReports: ReportInstanceDoc[]
): ReportRowDoc[] {
  const orderedColumns = getOrderedColumns(columns);
  const relevantHistory = historyReports.slice(0, 8);

  return rows.map((row) => {
    const cells = { ...row.cells };
    for (const column of orderedColumns) {
      if (column.id === "data" || column.kind === "date_flexible") continue;
      if (String(cells[column.id] || "").trim()) continue;
      const [topValue] = suggestCellValues(column.id, relevantHistory, 1);
      if (topValue) {
        cells[column.id] = topValue;
      }
    }
    return { ...row, cells };
  });
}

export function syncRowsToReportPeriod(
  rows: ReportRowDoc[],
  previousPeriod: PeriodRange,
  nextPeriod: PeriodRange
): ReportRowDoc[] {
  const shiftDays = getPeriodShiftDays(previousPeriod, nextPeriod);
  if (shiftDays == null || shiftDays === 0) return rows;
  return shiftRowsDatesByDays(rows, shiftDays);
}
