export const BUCHAREST_TZ = "Europe/Bucharest";

export function foldRo(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function formatLongRo(date: Date) {
  return date
    .toLocaleDateString("ro-RO", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: BUCHAREST_TZ,
    })
    .toUpperCase();
}

export function formatWeekdayRo(date: Date) {
  return date.toLocaleDateString("ro-RO", {
    weekday: "long",
    timeZone: BUCHAREST_TZ,
  });
}

export function formatDayMonthRo(isoOrDate: string | Date) {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleDateString("ro-RO", {
    day: "2-digit",
    month: "long",
    timeZone: BUCHAREST_TZ,
  });
}

export function formatShortDateRo(isoOrDate: string | Date) {
  const date = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleDateString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: BUCHAREST_TZ,
  });
}

export function formatMonthYearRo(date: Date) {
  return date.toLocaleDateString("ro-RO", {
    month: "long",
    year: "numeric",
    timeZone: BUCHAREST_TZ,
  });
}

export function daysBetween(from: Date, to: Date) {
  const a = startOfDay(from).getTime();
  const b = startOfDay(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function parseBicpDate(item: {
  dataTimestamp?: { toDate?: () => Date };
  data?: unknown;
}): Date | null {
  if (item.dataTimestamp?.toDate) return item.dataTimestamp.toDate();
  if (typeof item.data === "string") {
    const trimmed = item.data.trim();
    const slash = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slash) return new Date(Number(slash[3]), Number(slash[2]) - 1, Number(slash[1]));
    const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    const parsed = Date.parse(trimmed);
    if (Number.isFinite(parsed)) return new Date(parsed);
  }
  if (item.data && typeof item.data === "object" && "toDate" in item.data) {
    const toDate = (item.data as { toDate?: () => Date }).toDate;
    if (typeof toDate === "function") return toDate();
  }
  return null;
}
