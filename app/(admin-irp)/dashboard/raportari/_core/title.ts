export function formatDateRo(value: string) {
  const raw = value.trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[3]}.${match[2]}.${match[1]}`;
  }
  return raw;
}

export function buildAutoReportTitle(typeName: string, periodStart: string, periodEnd: string) {
  const base = typeName.trim() || "Raport";
  return `${base} ${formatDateRo(periodStart)} - ${formatDateRo(periodEnd)}`;
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
