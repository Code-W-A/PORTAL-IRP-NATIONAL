import { DateTime } from "luxon";

import type { ActivityStatus } from "@/app/(admin-irp)/calendar-activitati/types";

export const BUCHAREST_TIMEZONE = "Europe/Bucharest";

export function toBucharestDateTime(value: string | Date) {
  if (value instanceof Date) {
    return DateTime.fromJSDate(value, { zone: BUCHAREST_TIMEZONE });
  }
  return DateTime.fromISO(value, { setZone: true }).setZone(BUCHAREST_TIMEZONE);
}

export function asUtcIso(value: DateTime) {
  return value.toUTC().toISO({ suppressMilliseconds: true }) || value.toUTC().toISO() || new Date().toISOString();
}

export function normalizeUnknownToIso(value: unknown, fallback: string) {
  if (typeof value === "string") {
    const parsed = DateTime.fromISO(value, { setZone: true });
    if (parsed.isValid) {
      return parsed.toUTC().toISO({ suppressMilliseconds: true }) || fallback;
    }
    const asDate = new Date(value);
    if (!Number.isNaN(asDate.getTime())) {
      return asDate.toISOString();
    }
  }

  if (value && typeof value === "object") {
    try {
      if ("toDate" in value && typeof (value as { toDate?: () => Date }).toDate === "function") {
        const maybeDate = (value as { toDate: () => Date }).toDate();
        if (!Number.isNaN(maybeDate.getTime())) {
          return maybeDate.toISOString();
        }
      }
      if ("toMillis" in value && typeof (value as { toMillis?: () => number }).toMillis === "function") {
        const millis = (value as { toMillis: () => number }).toMillis();
        if (Number.isFinite(millis)) {
          return new Date(millis).toISOString();
        }
      }
    } catch {
      return fallback;
    }
  }

  return fallback;
}

export function datetimeLocalInputToIso(input: string) {
  const parsed = DateTime.fromFormat(input, "yyyy-LL-dd'T'HH:mm", {
    zone: BUCHAREST_TIMEZONE,
    setZone: true,
  });
  if (!parsed.isValid) return null;
  return asUtcIso(parsed);
}

export function dateInputToIsoStart(input: string) {
  const parsed = DateTime.fromFormat(input, "yyyy-LL-dd", {
    zone: BUCHAREST_TIMEZONE,
    setZone: true,
  }).startOf("day");
  if (!parsed.isValid) return null;
  return asUtcIso(parsed);
}

export function dateInputToIsoEndExclusive(input: string) {
  const parsed = DateTime.fromFormat(input, "yyyy-LL-dd", {
    zone: BUCHAREST_TIMEZONE,
    setZone: true,
  })
    .startOf("day")
    .plus({ days: 1 });
  if (!parsed.isValid) return null;
  return asUtcIso(parsed);
}

export function dateInputToIsoEndOfDay(input: string) {
  const parsed = DateTime.fromFormat(input, "yyyy-LL-dd", {
    zone: BUCHAREST_TIMEZONE,
    setZone: true,
  }).endOf("day");
  if (!parsed.isValid) return null;
  return asUtcIso(parsed);
}

export function isoToDateTimeLocalInput(iso: string) {
  const parsed = DateTime.fromISO(iso, { setZone: true }).setZone(BUCHAREST_TIMEZONE);
  if (!parsed.isValid) return "";
  return parsed.toFormat("yyyy-LL-dd'T'HH:mm");
}

export function isoToDateInput(iso: string) {
  const parsed = DateTime.fromISO(iso, { setZone: true }).setZone(BUCHAREST_TIMEZONE);
  if (!parsed.isValid) return "";
  return parsed.toFormat("yyyy-LL-dd");
}

export function isoToInclusiveDateInputFromExclusiveEnd(iso: string) {
  const parsed = DateTime.fromISO(iso, { setZone: true })
    .setZone(BUCHAREST_TIMEZONE)
    .minus({ days: 1 });
  if (!parsed.isValid) return "";
  return parsed.toFormat("yyyy-LL-dd");
}

export function buildSelectionSeed(selectionStart: Date, selectionEnd: Date, allDay: boolean) {
  const start = DateTime.fromJSDate(selectionStart, { zone: BUCHAREST_TIMEZONE });
  const end = DateTime.fromJSDate(selectionEnd, { zone: BUCHAREST_TIMEZONE });

  if (allDay) {
    const safeEnd = end <= start ? start.plus({ days: 1 }) : end;
    return {
      allDay: true,
      startDate: start.toFormat("yyyy-LL-dd"),
      endDate: safeEnd.minus({ days: 1 }).toFormat("yyyy-LL-dd"),
      startDateTime: "",
      endDateTime: "",
    };
  }

  const safeEnd = end <= start ? start.plus({ hours: 1 }) : end;
  return {
    allDay: false,
    startDate: "",
    endDate: "",
    startDateTime: start.toFormat("yyyy-LL-dd'T'HH:mm"),
    endDateTime: safeEnd.toFormat("yyyy-LL-dd'T'HH:mm"),
  };
}

export function weekdayFromIso(iso: string) {
  const parsed = toBucharestDateTime(iso);
  if (!parsed.isValid) return 1;
  return parsed.weekday % 7;
}

export function deriveActivityStatus(startIso: string, endIso: string, now = DateTime.now().setZone(BUCHAREST_TIMEZONE)): ActivityStatus {
  const start = DateTime.fromISO(startIso, { setZone: true });
  const end = DateTime.fromISO(endIso, { setZone: true });

  if (!start.isValid || !end.isValid) return "past";
  if (start > now) return "upcoming";
  if (end <= now) return "past";
  return "ongoing";
}
