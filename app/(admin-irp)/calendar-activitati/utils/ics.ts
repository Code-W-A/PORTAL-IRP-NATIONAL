import { DateTime, Duration } from "luxon";

import type { ActivityEvent, ActivityRecurrence } from "@/app/(admin-irp)/calendar-activitati/types";

type IcsProperty = {
  name: string;
  params: Record<string, string>;
  value: string;
};

type ParsedVEvent = {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  dtstart?: IcsProperty;
  dtend?: IcsProperty;
  duration?: string;
  rrule?: string;
  exdate: IcsProperty[];
  rdate: IcsProperty[];
  hasRecurrenceId: boolean;
};

export type IcsImportResult = {
  events: Array<{
    uid: string;
    title: string;
    startDateTime: string;
    endDateTime: string;
    allDay: boolean;
    description?: string;
    location?: string;
    recurrence?: ActivityRecurrence;
  }>;
  skipped: number;
  errors: Array<{ uid?: string; reason: string }>;
};

function unfoldLines(raw: string) {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const out: string[] = [];

  for (const line of lines) {
    if (!line) continue;
    if (/^[ \t]/.test(line) && out.length) {
      out[out.length - 1] = `${out[out.length - 1]}${line.slice(1)}`;
      continue;
    }
    out.push(line);
  }

  return out;
}

function parseProperty(line: string): IcsProperty | null {
  const idx = line.indexOf(":");
  if (idx <= 0) return null;

  const left = line.slice(0, idx);
  const value = line.slice(idx + 1);

  const parts = left.split(";");
  const name = parts[0]?.trim().toUpperCase();
  if (!name) return null;

  const params: Record<string, string> = {};
  for (const param of parts.slice(1)) {
    const [k, v] = param.split("=");
    if (!k || v === undefined) continue;
    params[k.trim().toUpperCase()] = String(v).trim();
  }

  return {
    name,
    params,
    value: value.trim(),
  };
}

function parseVEvents(lines: string[]) {
  const events: ParsedVEvent[] = [];
  let current: ParsedVEvent | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.toUpperCase() === "BEGIN:VEVENT") {
      current = {
        uid: "",
        summary: "",
        exdate: [],
        rdate: [],
        hasRecurrenceId: false,
      };
      continue;
    }

    if (trimmed.toUpperCase() === "END:VEVENT") {
      if (current) {
        events.push(current);
      }
      current = null;
      continue;
    }

    if (!current) continue;

    const prop = parseProperty(trimmed);
    if (!prop) continue;

    if (prop.name === "UID") current.uid = prop.value;
    if (prop.name === "SUMMARY") current.summary = prop.value;
    if (prop.name === "DESCRIPTION") current.description = prop.value;
    if (prop.name === "LOCATION") current.location = prop.value;
    if (prop.name === "DTSTART") current.dtstart = prop;
    if (prop.name === "DTEND") current.dtend = prop;
    if (prop.name === "DURATION") current.duration = prop.value;
    if (prop.name === "RRULE") current.rrule = `RRULE:${prop.value}`;
    if (prop.name === "EXDATE") current.exdate.push(prop);
    if (prop.name === "RDATE") current.rdate.push(prop);
    if (prop.name === "RECURRENCE-ID") current.hasRecurrenceId = true;
  }

  return events;
}

function toTimezone(params: Record<string, string>, fallback: string) {
  const tzid = String(params.TZID || "").trim();
  return tzid || fallback;
}

function parseDateValue(value: string, timezone: string) {
  const v = value.trim();

  // DATE
  if (/^\d{8}$/.test(v)) {
    const dt = DateTime.fromFormat(v, "yyyyLLdd", { zone: timezone, setZone: true }).startOf("day");
    if (!dt.isValid) return null;
    return {
      dt,
      allDay: true,
    };
  }

  // DATE-TIME (UTC)
  if (/^\d{8}T\d{6}Z$/.test(v)) {
    const dt = DateTime.fromFormat(v, "yyyyLLdd'T'HHmmss'Z'", { zone: "utc", setZone: true });
    if (!dt.isValid) return null;
    return {
      dt,
      allDay: false,
    };
  }

  // DATE-TIME (local)
  if (/^\d{8}T\d{6}$/.test(v)) {
    const dt = DateTime.fromFormat(v, "yyyyLLdd'T'HHmmss", { zone: timezone, setZone: true });
    if (!dt.isValid) return null;
    return {
      dt,
      allDay: false,
    };
  }

  // DATE-TIME without seconds
  if (/^\d{8}T\d{4}Z$/.test(v)) {
    const dt = DateTime.fromFormat(v, "yyyyLLdd'T'HHmm'Z'", { zone: "utc", setZone: true });
    if (!dt.isValid) return null;
    return {
      dt,
      allDay: false,
    };
  }

  if (/^\d{8}T\d{4}$/.test(v)) {
    const dt = DateTime.fromFormat(v, "yyyyLLdd'T'HHmm", { zone: timezone, setZone: true });
    if (!dt.isValid) return null;
    return {
      dt,
      allDay: false,
    };
  }

  // Fallback ISO
  const iso = DateTime.fromISO(v, { zone: timezone, setZone: true });
  if (!iso.isValid) return null;
  return {
    dt: iso,
    allDay: false,
  };
}

function parseDuration(value: string) {
  // Basic ISO 8601 duration: PnDTnHnMnS
  try {
    const dur = Duration.fromISO(value);
    if (!dur.isValid) return null;
    return dur;
  } catch {
    return null;
  }
}

function toUtcIso(dt: DateTime) {
  return dt.toUTC().toISO({ suppressMilliseconds: true }) || dt.toUTC().toISO();
}

function parseDateList(prop: IcsProperty, timezone: string, allDay: boolean) {
  const effectiveTimezone = toTimezone(prop.params, timezone);
  const afterColon = prop.value;
  const parts = afterColon.split(",").map((item) => item.trim()).filter(Boolean);
  const out: string[] = [];

  for (const part of parts) {
    const parsed = parseDateValue(part, effectiveTimezone);
    if (!parsed) continue;

    if (allDay) {
      out.push(toUtcIso(parsed.dt.setZone(effectiveTimezone).startOf("day")) || parsed.dt.toISO() || "");
    } else {
      out.push(toUtcIso(parsed.dt) || parsed.dt.toISO() || "");
    }
  }

  return out.filter(Boolean);
}

export function parseIcsToEvents(text: string, options?: { defaultTimezone?: string }): IcsImportResult {
  const defaultTimezone = options?.defaultTimezone || "Europe/Bucharest";
  const lines = unfoldLines(text);
  const vevents = parseVEvents(lines);

  const result: IcsImportResult = {
    events: [],
    skipped: 0,
    errors: [],
  };

  for (const item of vevents) {
    try {
      if (item.hasRecurrenceId) {
        result.skipped += 1;
        continue;
      }

      const uid = String(item.uid || "").trim();
      if (!uid) {
        result.errors.push({ reason: "Missing UID" });
        continue;
      }

      if (!item.dtstart) {
        result.errors.push({ uid, reason: "Missing DTSTART" });
        continue;
      }

      const startTz = toTimezone(item.dtstart.params, defaultTimezone);
      const isDateValue = String(item.dtstart.params.VALUE || "").toUpperCase() === "DATE";

      const startParsed = parseDateValue(item.dtstart.value, startTz);
      if (!startParsed) {
        result.errors.push({ uid, reason: "Invalid DTSTART" });
        continue;
      }

      const allDay = isDateValue || startParsed.allDay;
      const start = allDay ? startParsed.dt.setZone(startTz).startOf("day") : startParsed.dt;

      let end: DateTime | null = null;
      if (item.dtend) {
        const endTz = toTimezone(item.dtend.params, startTz);
        const endParsed = parseDateValue(item.dtend.value, endTz);
        if (endParsed) {
          end = allDay ? endParsed.dt.setZone(endTz).startOf("day") : endParsed.dt;
        }
      }

      if (!end && item.duration) {
        const dur = parseDuration(item.duration);
        if (dur) {
          end = start.plus(dur);
        }
      }

      if (!end) {
        end = allDay ? start.plus({ days: 1 }) : start.plus({ hours: 1 });
      }

      const startIso = toUtcIso(start) || start.toISO() || new Date().toISOString();
      const endIso = toUtcIso(end) || end.toISO() || new Date().toISOString();

      const rrule = item.rrule ? String(item.rrule).trim() : "";
      const exdate = item.exdate.flatMap((prop) => parseDateList(prop, startTz, allDay));
      const rdate = item.rdate.flatMap((prop) => parseDateList(prop, startTz, allDay));

      const recurrence: ActivityRecurrence | undefined = rrule
        ? {
            freq: "none",
            rrule,
            exdate: exdate.length ? exdate : undefined,
            rdate: rdate.length ? rdate : undefined,
            timezone: startTz,
          }
        : undefined;

      result.events.push({
        uid,
        title: String(item.summary || "Activitate").trim() || "Activitate",
        description: item.description,
        location: item.location,
        startDateTime: startIso,
        endDateTime: endIso,
        allDay,
        recurrence,
      });
    } catch (error) {
      result.errors.push({ uid: item.uid || undefined, reason: error instanceof Error ? error.message : "Parse error" });
    }
  }

  return result;
}

export function buildFirestoreActivityEvent(input: {
  id: string;
  nowIso: string;
  userId: string;
  workspaceId: string;
  parsed: IcsImportResult["events"][number];
}): ActivityEvent {
  const event: ActivityEvent = {
    id: input.id,
    title: input.parsed.title,
    startDateTime: input.parsed.startDateTime,
    endDateTime: input.parsed.endDateTime,
    allDay: input.parsed.allDay,
    createdAt: input.nowIso,
    updatedAt: input.nowIso,
    userId: input.userId,
    workspaceId: input.workspaceId,
  };

  if (input.parsed.description) event.description = input.parsed.description;
  if (input.parsed.location) event.location = input.parsed.location;
  if (input.parsed.recurrence) event.recurrence = input.parsed.recurrence;

  return event;
}
