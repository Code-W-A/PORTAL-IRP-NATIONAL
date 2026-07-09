import { createId, sortColumns } from "@/app/(admin-irp)/dashboard/raportari/_core/firestore";
import { resolvePeriodFromPreset } from "@/app/(admin-irp)/dashboard/raportari/_core/period";
import { suggestRowsFromHistory } from "@/app/(admin-irp)/dashboard/raportari/_core/recommendations";
import {
  buildActivitatiImpactTitle,
  buildAutoReportTitle,
  buildIntentiiMediatizareTitle,
  formatDateRo,
} from "@/app/(admin-irp)/dashboard/raportari/_core/title";
import {
  ACTIVITATI_IMPACT_TYPE_ID,
} from "@/app/(admin-irp)/dashboard/raportari/_core/templates/activitatiImpact";
import {
  DEFAULT_UNITATE_LABEL,
  INTENTII_MEDIATIZARE_TYPE_ID,
} from "@/app/(admin-irp)/dashboard/raportari/_core/templates/intentiiMediatizare";
import type {
  PeriodPreset,
  ReportInstanceDoc,
  ReportRowDoc,
  ReportTypeDoc,
  ReportTypePeriodPrefs,
} from "@/app/(admin-irp)/dashboard/raportari/_core/types";

export type ReportDraft = Omit<ReportInstanceDoc, "id" | "createdAt" | "updatedAt">;

export function normalizeReportDraft(draft: ReportDraft): ReportDraft {
  const columns = sortColumns(draft.columnsSnapshot).map((column, index) => ({
    ...column,
    label: column.label.trim(),
    order: index,
  }));

  const rows = draft.rows.map((row) => {
    const cells: Record<string, string> = {};
    columns.forEach((column) => {
      cells[column.id] = String(row.cells[column.id] || "").trim();
    });
    return {
      id: String(row.id || createId()),
      cells,
    } satisfies ReportRowDoc;
  });

  return {
    ...draft,
    typeNameSnapshot: draft.typeNameSnapshot.trim(),
    typeDescriptionSnapshot: draft.typeDescriptionSnapshot.trim(),
    title: draft.title.trim(),
    registrationNumber: draft.registrationNumber.trim(),
    periodStart: draft.periodStart,
    periodEnd: draft.periodEnd,
    columnsSnapshot: columns,
    rows,
  };
}

export function serializeReportDraft(draft: ReportDraft) {
  return JSON.stringify(normalizeReportDraft(draft));
}

export function formatFirestoreTimestamp(value: unknown) {
  try {
    if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
      const date = value.toDate() as Date;
      return `${formatDateRo(date.toISOString().slice(0, 10))} ${date.toTimeString().slice(0, 5)}`;
    }
  } catch {}
  return "";
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

export function buildReportTitle(type: ReportTypeDoc, periodStart: string, periodEnd: string) {
  if (type.id === INTENTII_MEDIATIZARE_TYPE_ID) {
    return buildIntentiiMediatizareTitle(periodStart, periodEnd);
  }
  if (type.id === ACTIVITATI_IMPACT_TYPE_ID) {
    return buildActivitatiImpactTitle(periodStart, periodEnd);
  }
  return buildAutoReportTitle(type.name, periodStart, periodEnd);
}

export function buildDraftFromType(
  type: ReportTypeDoc,
  preset: PeriodPreset,
  options?: {
    custom?: { start: string; end: string };
    prefs?: ReportTypePeriodPrefs | null;
    registrationNumber?: string;
    rows?: ReportRowDoc[];
    persoaneDefault?: string;
  }
): ReportDraft {
  const lastSaved =
    options?.prefs?.lastPeriodStart && options?.prefs?.lastPeriodEnd
      ? { start: options.prefs.lastPeriodStart, end: options.prefs.lastPeriodEnd }
      : null;
  const period = resolvePeriodFromPreset(preset, options?.custom, new Date(), lastSaved);

  const rows =
    options?.rows ||
    suggestRowsFromHistory(null, period, {
      typeId: type.id,
      unitate: DEFAULT_UNITATE_LABEL,
      persoane: options?.persoaneDefault,
    });

  return {
    typeId: type.id,
    typeNameSnapshot: type.name,
    typeDescriptionSnapshot: type.description,
    columnsSnapshot: sortColumns(type.columns).map((column, index) => ({
      ...column,
      order: index,
    })),
    title: buildReportTitle(type, period.start, period.end),
    registrationNumber: options?.registrationNumber || options?.prefs?.lastRegistrationNumber || "",
    periodPreset: preset,
    periodStart: period.start,
    periodEnd: period.end,
    rows,
  };
}

export function reportDraftFromInstance(report: ReportInstanceDoc): ReportDraft {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = report;
  return normalizeReportDraft(rest);
}
