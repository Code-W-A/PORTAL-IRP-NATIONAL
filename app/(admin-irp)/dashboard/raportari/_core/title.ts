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
