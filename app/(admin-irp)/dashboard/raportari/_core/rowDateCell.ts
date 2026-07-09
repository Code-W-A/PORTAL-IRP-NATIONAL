import { addDays, format, parseISO } from "date-fns";

import { formatDateRo, formatPeriodRangeLabel } from "@/app/(admin-irp)/dashboard/raportari/_core/title";

export type RowDateCellMode = "single" | "range" | "legacy" | "empty";

export type ParsedRowDateCell = {
  mode: RowDateCellMode;
  start?: string;
  end?: string;
  display: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const RANGE_DELIMITER = "..";

function isIsoDate(value: string) {
  return ISO_DATE.test(value.trim());
}

function parseLegacyRange(text: string): ParsedRowDateCell | null {
  const trimmed = text.trim();
  const match = trimmed.match(/^(\d{1,2})\s*-\s*(\d{1,2})[./](\d{2})[./](\d{4})$/);
  if (!match) return null;

  const startDay = match[1].padStart(2, "0");
  const endDay = match[2].padStart(2, "0");
  const month = match[3].padStart(2, "0");
  const year = match[4];
  const start = `${year}-${month}-${startDay}`;
  const end = `${year}-${month}-${endDay}`;

  if (!isIsoDate(start) || !isIsoDate(end)) return null;

  return {
    mode: "range",
    start,
    end,
    display: formatPeriodRangeLabel(start, end),
  };
}

function parseLegacySingle(text: string): ParsedRowDateCell | null {
  const trimmed = text.trim();
  const match = trimmed.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (!match) return null;

  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const year = match[3];
  const start = `${year}-${month}-${day}`;

  if (!isIsoDate(start)) return null;

  return {
    mode: "single",
    start,
    display: formatDateRo(start),
  };
}

export function parseRowDateCell(raw: string): ParsedRowDateCell {
  const trimmed = String(raw || "").trim();
  if (!trimmed) {
    return { mode: "empty", display: "" };
  }

  if (trimmed.includes(RANGE_DELIMITER)) {
    const [startRaw, endRaw] = trimmed.split(RANGE_DELIMITER);
    const start = String(startRaw || "").trim();
    const end = String(endRaw || "").trim();
    if (isIsoDate(start) && isIsoDate(end)) {
      return {
        mode: "range",
        start,
        end,
        display: formatPeriodRangeLabel(start, end),
      };
    }
  }

  if (isIsoDate(trimmed)) {
    return {
      mode: "single",
      start: trimmed,
      display: formatDateRo(trimmed),
    };
  }

  const legacyRange = parseLegacyRange(trimmed);
  if (legacyRange) return legacyRange;

  const legacySingle = parseLegacySingle(trimmed);
  if (legacySingle) return legacySingle;

  return {
    mode: "legacy",
    display: trimmed,
  };
}

export function serializeRowDateCell(
  mode: Exclude<RowDateCellMode, "legacy" | "empty">,
  start: string,
  end?: string
): string {
  if (mode === "single") {
    return start.trim();
  }
  return `${start.trim()}${RANGE_DELIMITER}${String(end || "").trim()}`;
}

export function formatRowDateCellDisplay(raw: string): string {
  const parsed = parseRowDateCell(raw);
  return parsed.display || raw.trim();
}

export function getRowDateSortKey(raw: string): string {
  const parsed = parseRowDateCell(raw);
  if (parsed.mode === "single" && parsed.start) return parsed.start;
  if (parsed.mode === "range" && parsed.start) return parsed.start;
  return raw.trim().toLowerCase();
}

export function getRowDateBounds(raw: string): { start: string | null; end: string | null } {
  const parsed = parseRowDateCell(raw);
  if (parsed.mode === "single" && parsed.start) {
    return { start: parsed.start, end: parsed.start };
  }
  if (parsed.mode === "range" && parsed.start && parsed.end) {
    return { start: parsed.start, end: parsed.end };
  }
  return { start: null, end: null };
}

export function isRowDateWithinReportPeriod(
  raw: string,
  reportStart: string,
  reportEnd: string
): boolean {
  const bounds = getRowDateBounds(raw);
  if (!bounds.start || !bounds.end) return true;
  if (!isIsoDate(reportStart) || !isIsoDate(reportEnd)) return true;
  return bounds.start >= reportStart && bounds.end <= reportEnd;
}

export function shiftRowDateCellByDays(raw: string, days: number): string {
  const parsed = parseRowDateCell(raw);
  if (parsed.mode === "single" && parsed.start) {
    const next = addDays(parseISO(parsed.start), days);
    return serializeRowDateCell("single", format(next, "yyyy-MM-dd"));
  }
  if (parsed.mode === "range" && parsed.start && parsed.end) {
    const nextStart = addDays(parseISO(parsed.start), days);
    const nextEnd = addDays(parseISO(parsed.end), days);
    return serializeRowDateCell(
      "range",
      format(nextStart, "yyyy-MM-dd"),
      format(nextEnd, "yyyy-MM-dd")
    );
  }
  return raw;
}

export function isGenericPeriodData(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (isIsoDate(trimmed)) return true;
  if (trimmed.includes(RANGE_DELIMITER)) return true;
  return /\d{1,2}\s*-\s*\d{1,2}[./]\d{2}[./]\d{4}/.test(trimmed);
}

export function formatCellValueForExport(
  value: string,
  columnKind: string
): string {
  if (columnKind === "date_flexible") {
    return formatRowDateCellDisplay(value);
  }
  return String(value || "");
}
