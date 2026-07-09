export function formatDateRo(value: string) {
  const raw = value.trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[3]}.${match[2]}.${match[1]}`;
  }
  return raw;
}

export function formatPeriodRangeLabel(periodStart: string, periodEnd: string) {
  const startMatch = periodStart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const endMatch = periodEnd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!startMatch || !endMatch) {
    return `${formatDateRo(periodStart)} - ${formatDateRo(periodEnd)}`;
  }

  const startDay = String(Number(startMatch[3]));
  const endDay = String(Number(endMatch[3]));
  const endMonth = endMatch[2];
  const endYear = endMatch[1];

  if (startMatch[1] === endMatch[1] && startMatch[2] === endMatch[2]) {
    return `${startDay} - ${endDay}.${endMonth}.${endYear}`;
  }

  return `${startDay}.${startMatch[2]}.${startMatch[1]} - ${endDay}.${endMonth}.${endYear}`;
}

export function buildAutoReportTitle(typeName: string, periodStart: string, periodEnd: string) {
  const base = typeName.trim() || "Raport";
  return `${base} ${formatPeriodRangeLabel(periodStart, periodEnd)}`;
}

export function buildIntentiiMediatizareTitle(periodStart: string, periodEnd: string) {
  return `INTENȚII DE MEDIATIZARE A ACTIVITĂȚILOR PLANIFICATE PENTRU PERIOADA ${formatPeriodRangeLabel(
    periodStart,
    periodEnd
  )}`.toUpperCase();
}

const MONTHS_RO_UPPER = [
  "IANUARIE",
  "FEBRUARIE",
  "MARTIE",
  "APRILIE",
  "MAI",
  "IUNIE",
  "IULIE",
  "AUGUST",
  "SEPTEMBRIE",
  "OCTOMBRIE",
  "NOIEMBRIE",
  "DECEMBRIE",
];

function parseIsoDateParts(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return {
    year: match[1],
    monthIndex: Number(match[2]) - 1,
    day: String(Number(match[3])),
  };
}

export function formatImpactPeriodLabel(periodStart: string, periodEnd: string) {
  const start = parseIsoDateParts(periodStart);
  const end = parseIsoDateParts(periodEnd);
  if (!start || !end) {
    return `${formatDateRo(periodStart)} - ${formatDateRo(periodEnd)}`;
  }

  const startMonth = MONTHS_RO_UPPER[start.monthIndex] || "";
  const endMonth = MONTHS_RO_UPPER[end.monthIndex] || "";

  if (start.year === end.year && start.monthIndex === end.monthIndex) {
    return `${start.day} - ${end.day} ${endMonth}`;
  }

  if (start.year === end.year) {
    return `${start.day} ${startMonth} - ${end.day} ${endMonth}`;
  }

  return `${start.day} ${startMonth} ${start.year} - ${end.day} ${endMonth} ${end.year}`;
}

export function buildActivitatiImpactTitle(periodStart: string, periodEnd: string) {
  return `ACTIVITATEA DE IMPACT DERULATĂ ÎN PERIOADA ${formatImpactPeriodLabel(
    periodStart,
    periodEnd
  )}`.toUpperCase();
}

export type ParsedReportPeriod = {
  periodStart: string;
  periodEnd: string;
};

const MONTHS_RO_PATTERN = MONTHS_RO_UPPER.join("|");

function normalizeRoText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function monthNumberFromRoName(name: string): number | null {
  const normalized = normalizeRoText(name);
  const index = MONTHS_RO_UPPER.findIndex((month) => normalizeRoText(month) === normalized);
  return index >= 0 ? index + 1 : null;
}

function toIsoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

function parseImpactPeriodFromTitle(title: string, hintYear?: number): ParsedReportPeriod | null {
  const normalized = normalizeRoText(title);
  const year = hintYear || new Date().getFullYear();

  const crossYearMatch = normalized.match(
    new RegExp(
      `PERIOADA\\s+(\\d{1,2})\\s+(${MONTHS_RO_PATTERN})\\s+(\\d{4})\\s*-\\s*(\\d{1,2})\\s+(${MONTHS_RO_PATTERN})\\s+(\\d{4})`
    )
  );
  if (crossYearMatch) {
    const startMonth = monthNumberFromRoName(crossYearMatch[2]);
    const endMonth = monthNumberFromRoName(crossYearMatch[5]);
    if (!startMonth || !endMonth) return null;
    const periodStart = toIsoDate(Number(crossYearMatch[3]), startMonth, Number(crossYearMatch[1]));
    const periodEnd = toIsoDate(Number(crossYearMatch[6]), endMonth, Number(crossYearMatch[4]));
    if (!periodStart || !periodEnd) return null;
    return { periodStart, periodEnd };
  }

  const crossMonthMatch = normalized.match(
    new RegExp(`PERIOADA\\s+(\\d{1,2})\\s+(${MONTHS_RO_PATTERN})\\s*-\\s*(\\d{1,2})\\s+(${MONTHS_RO_PATTERN})`)
  );
  if (crossMonthMatch) {
    const startMonth = monthNumberFromRoName(crossMonthMatch[2]);
    const endMonth = monthNumberFromRoName(crossMonthMatch[4]);
    if (!startMonth || !endMonth) return null;
    const periodStart = toIsoDate(year, startMonth, Number(crossMonthMatch[1]));
    const periodEnd = toIsoDate(year, endMonth, Number(crossMonthMatch[3]));
    if (!periodStart || !periodEnd) return null;
    return { periodStart, periodEnd };
  }

  const sameMonthMatch = normalized.match(
    new RegExp(`PERIOADA\\s+(\\d{1,2})\\s*-\\s*(\\d{1,2})\\s+(${MONTHS_RO_PATTERN})`)
  );
  if (sameMonthMatch) {
    const month = monthNumberFromRoName(sameMonthMatch[3]);
    if (!month) return null;
    const periodStart = toIsoDate(year, month, Number(sameMonthMatch[1]));
    const periodEnd = toIsoDate(year, month, Number(sameMonthMatch[2]));
    if (!periodStart || !periodEnd) return null;
    return { periodStart, periodEnd };
  }

  return null;
}

function parseIntentiiPeriodFromTitle(title: string): ParsedReportPeriod | null {
  const normalized = title.trim();

  const crossMonthMatch = normalized.match(
    /PERIOADA\s+(\d{1,2})\.(\d{2})\.(\d{4})\s*-\s*(\d{1,2})\.(\d{2})\.(\d{4})/i
  );
  if (crossMonthMatch) {
    const periodStart = toIsoDate(
      Number(crossMonthMatch[3]),
      Number(crossMonthMatch[2]),
      Number(crossMonthMatch[1])
    );
    const periodEnd = toIsoDate(
      Number(crossMonthMatch[6]),
      Number(crossMonthMatch[5]),
      Number(crossMonthMatch[4])
    );
    if (!periodStart || !periodEnd) return null;
    return { periodStart, periodEnd };
  }

  const sameMonthMatch = normalized.match(/PERIOADA\s+(\d{1,2})\s*-\s*(\d{1,2})\.(\d{2})\.(\d{4})/i);
  if (sameMonthMatch) {
    const periodStart = toIsoDate(
      Number(sameMonthMatch[4]),
      Number(sameMonthMatch[3]),
      Number(sameMonthMatch[1])
    );
    const periodEnd = toIsoDate(
      Number(sameMonthMatch[4]),
      Number(sameMonthMatch[3]),
      Number(sameMonthMatch[2])
    );
    if (!periodStart || !periodEnd) return null;
    return { periodStart, periodEnd };
  }

  return null;
}

export function parsePeriodFromReportTitle(
  title: string,
  typeId: string,
  hintYear?: number
): ParsedReportPeriod | null {
  const trimmed = title.trim();
  if (!trimmed) return null;

  if (typeId === "activitati-impact") {
    return parseImpactPeriodFromTitle(trimmed, hintYear);
  }

  if (typeId === "intentii-mediatizare") {
    return parseIntentiiPeriodFromTitle(trimmed);
  }

  const genericMatch = trimmed.match(/PERIOADA\s+(.+)$/i);
  if (!genericMatch) return null;

  const impact = parseImpactPeriodFromTitle(`PERIOADA ${genericMatch[1]}`, hintYear);
  if (impact) return impact;

  return parseIntentiiPeriodFromTitle(`PERIOADA ${genericMatch[1]}`);
}

export function safeFilename(name: string) {
  return (
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._\-\s]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 140) || "raport"
  );
}
