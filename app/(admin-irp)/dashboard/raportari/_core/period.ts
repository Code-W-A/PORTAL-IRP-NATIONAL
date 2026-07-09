import {
  addDays,
  endOfWeek,
  format,
  parseISO,
  startOfWeek,
  subWeeks,
} from "date-fns";

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
  const previousMonth = new Date(baseDate.getFullYear(), baseDate.getMonth() - 1, 1);
  const end = new Date(baseDate.getFullYear(), baseDate.getMonth(), 0);
  return {
    start: toIsoDate(previousMonth),
    end: toIsoDate(end),
  };
}

export function getPreviousYearRange(baseDate = new Date()): PeriodRange {
  const year = baseDate.getFullYear() - 1;
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  };
}

export function getPreviousWeekRange(baseDate = new Date()): PeriodRange {
  const previousWeek = subWeeks(baseDate, 1);
  return {
    start: toIsoDate(startOfWeek(previousWeek, { weekStartsOn: 1 })),
    end: toIsoDate(endOfWeek(previousWeek, { weekStartsOn: 1 })),
  };
}

export function getCurrentWeekRange(baseDate = new Date()): PeriodRange {
  return {
    start: toIsoDate(startOfWeek(baseDate, { weekStartsOn: 1 })),
    end: toIsoDate(endOfWeek(baseDate, { weekStartsOn: 1 })),
  };
}

export function getNextWeekFromRange(last: PeriodRange): PeriodRange {
  const start = parseISO(last.start);
  const end = parseISO(last.end);
  const durationDays = Math.max(
    0,
    Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000))
  );
  const nextStart = addDays(end, 1);
  const nextEnd = addDays(nextStart, durationDays);
  return {
    start: toIsoDate(nextStart),
    end: toIsoDate(nextEnd),
  };
}

export function getDefaultCustomRange(baseDate = new Date()): PeriodRange {
  return getCurrentWeekRange(baseDate);
}

export function resolvePeriodFromPreset(
  preset: PeriodPreset,
  custom?: Partial<PeriodRange>,
  baseDate = new Date(),
  lastSaved?: PeriodRange | null
): PeriodRange {
  if (preset === "previous_month") return getPreviousMonthRange(baseDate);
  if (preset === "previous_year") return getPreviousYearRange(baseDate);
  if (preset === "previous_week") return getPreviousWeekRange(baseDate);
  if (preset === "next_week") {
    if (lastSaved && isPeriodRangeValid(lastSaved.start, lastSaved.end)) {
      return getNextWeekFromRange(lastSaved);
    }
    return getCurrentWeekRange(baseDate);
  }

  const start = String(custom?.start || "");
  const end = String(custom?.end || "");
  if (!isPeriodRangeValid(start, end)) {
    return getDefaultCustomRange(baseDate);
  }
  return { start, end };
}
