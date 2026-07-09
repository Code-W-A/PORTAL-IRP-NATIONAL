import type { InterventionRecord, InterventionStatsFilters } from "@/types/interventionStats";

function monthKey(isoDate: string) {
  const parsed = Date.parse(isoDate);
  if (!Number.isFinite(parsed)) return "";
  const date = new Date(parsed);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function yearKey(isoDate: string) {
  const parsed = Date.parse(isoDate);
  if (!Number.isFinite(parsed)) return "";
  return String(new Date(parsed).getFullYear());
}

export function getPresetDateRange(preset: InterventionStatsFilters["preset"]): { start: Date; end: Date } | null {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (preset) {
    case "last7": {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "last30": {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "last365": {
      const start = new Date(now);
      start.setDate(start.getDate() - 365);
      start.setHours(0, 0, 0, 0);
      return { start, end };
    }
    case "currentYear": {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      return { start, end };
    }
    case "all":
      return null;
    default:
      return null;
  }
}

export function filterInterventionRecords(
  records: InterventionRecord[],
  filters: InterventionStatsFilters
): InterventionRecord[] {
  let startMs: number | null = null;
  let endMs: number | null = null;

  if (filters.startDate) {
    const parsed = Date.parse(filters.startDate);
    if (Number.isFinite(parsed)) startMs = parsed;
  }
  if (filters.endDate) {
    const parsed = Date.parse(filters.endDate);
    if (Number.isFinite(parsed)) endMs = parsed;
  }

  if (!startMs && !endMs && filters.preset) {
    const range = getPresetDateRange(filters.preset);
    if (range) {
      startMs = range.start.getTime();
      endMs = range.end.getTime();
    }
  }

  return records.filter((item) => {
    if (filters.typeId && item.typeId !== filters.typeId) return false;

    const occurredMs = Date.parse(item.occurredAt);
    if (!Number.isFinite(occurredMs)) return false;
    if (startMs !== null && occurredMs < startMs) return false;
    if (endMs !== null && occurredMs > endMs) return false;

    return true;
  });
}

export function computeInterventionStats(records: InterventionRecord[]) {
  const byTypeMap: Record<string, { typeName: string; total: number; communicated: number }> = {};
  const monthlyMap: Record<string, { total: number; communicated: number }> = {};
  const yearlyMap: Record<string, { total: number; communicated: number }> = {};

  let total = 0;
  let communicated = 0;

  for (const item of records) {
    total += 1;
    if (item.communicated) communicated += 1;

    if (!byTypeMap[item.typeId]) {
      byTypeMap[item.typeId] = { typeName: item.typeName, total: 0, communicated: 0 };
    }
    byTypeMap[item.typeId].total += 1;
    if (item.communicated) byTypeMap[item.typeId].communicated += 1;

    const month = monthKey(item.occurredAt);
    if (month) {
      if (!monthlyMap[month]) monthlyMap[month] = { total: 0, communicated: 0 };
      monthlyMap[month].total += 1;
      if (item.communicated) monthlyMap[month].communicated += 1;
    }

    const year = yearKey(item.occurredAt);
    if (year) {
      if (!yearlyMap[year]) yearlyMap[year] = { total: 0, communicated: 0 };
      yearlyMap[year].total += 1;
      if (item.communicated) yearlyMap[year].communicated += 1;
    }
  }

  const byType = Object.entries(byTypeMap)
    .map(([typeId, stats]) => ({ typeId, ...stats }))
    .sort((a, b) => b.total - a.total || a.typeName.localeCompare(b.typeName, "ro"));

  const monthlyTotals = Object.entries(monthlyMap)
    .map(([month, stats]) => ({ month, ...stats }))
    .sort((a, b) => a.month.localeCompare(b.month));

  const yearlyTotals = Object.entries(yearlyMap)
    .map(([year, stats]) => ({ year, ...stats }))
    .sort((a, b) => a.year.localeCompare(b.year));

  return { total, communicated, byType, monthlyTotals, yearlyTotals };
}

export function formatInterventionDateLabel(isoDate: string) {
  const parsed = Date.parse(isoDate);
  if (!Number.isFinite(parsed)) return "—";
  return new Date(parsed).toLocaleDateString("ro-RO");
}

export function todayIsoDate() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

export function isoFromYmd(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return todayIsoDate();
  return new Date(y, m - 1, d).toISOString();
}

export function ymdFromIso(isoDate: string) {
  const parsed = Date.parse(isoDate);
  if (!Number.isFinite(parsed)) return "";
  const date = new Date(parsed);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
