import { endOfMonth, endOfYear, format, startOfMonth, startOfYear, subMonths, subYears } from "date-fns";

import type { PeriodPreset } from "./types";

export type PeriodRange = {
  start: string;
  end: string;
};

export function toIsoDate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

export function isPeriodRangeValid(start: string, end: string) {
  return isIsoDate(start) && isIsoDate(end) && start <= end;
}

export function getPreviousMonthRange(baseDate = new Date()): PeriodRange {
  const previousMonth = subMonths(baseDate, 1);
  return {
    start: toIsoDate(startOfMonth(previousMonth)),
    end: toIsoDate(endOfMonth(previousMonth)),
  };
}

export function getPreviousYearRange(baseDate = new Date()): PeriodRange {
  const previousYear = subYears(baseDate, 1);
  return {
    start: toIsoDate(startOfYear(previousYear)),
    end: toIsoDate(endOfYear(previousYear)),
  };
}

export function getDefaultCustomRange(baseDate = new Date()): PeriodRange {
  return {
    start: toIsoDate(baseDate),
    end: toIsoDate(baseDate),
  };
}

export function resolvePeriodFromPreset(
  preset: PeriodPreset,
  custom?: Partial<PeriodRange>,
  baseDate = new Date()
): PeriodRange {
  if (preset === "previous_month") return getPreviousMonthRange(baseDate);
  if (preset === "previous_year") return getPreviousYearRange(baseDate);

  const start = String(custom?.start || "");
  const end = String(custom?.end || "");
  if (!isPeriodRangeValid(start, end)) {
    return getDefaultCustomRange(baseDate);
  }
  return { start, end };
}
