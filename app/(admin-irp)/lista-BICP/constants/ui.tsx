export const BICP_VIEW_MODE_KEY = "bicpViewMode";
export type BicpViewMode = "card" | "table";

export function getDefaultViewMode(): BicpViewMode {
  if (typeof window === "undefined") return "table";
  const saved = localStorage.getItem(BICP_VIEW_MODE_KEY);
  if (saved === "card" || saved === "table") return saved;
  return window.matchMedia("(max-width: 767px)").matches ? "card" : "table";
}

export const pageBg = "bg-[#F6F8FB]";
export const surface = "bg-white border border-[#E5E7EB]";
export const subtleShadow = "shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

export const btnBase =
  "inline-flex items-center justify-center gap-2 h-9 px-3 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D4ED8] focus-visible:ring-offset-1";

export const btnPrimaryGreen =
  `${btnBase} bg-[#047857] hover:bg-[#065f46] text-white border border-[#047857]`;

export const btnSecondary =
  `${btnBase} bg-white border border-[#E5E7EB] text-[#334155] hover:bg-[#F8FAFC] hover:border-[#CBD5E1]`;

export const btnAccent =
  `${btnBase} bg-[#1D4ED8] hover:bg-[#1e40af] text-white border border-[#1D4ED8]`;

export const inputBase =
  "h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]";

export const selectBase =
  "h-9 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#1D4ED8]/20 focus:border-[#1D4ED8]";

export const chipBase =
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-[#E5E7EB] bg-[#F8FAFC] text-[#334155]";

const BADGE_STYLES: Record<string, string> = {
  "știre": "bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]",
  "buletin informativ": "bg-[#ECFDF5] text-[#047857] border-[#BBF7D0]",
  "comunicat de presă": "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]",
};

const DEFAULT_BADGE = "bg-[#F8FAFC] text-[#64748B] border-[#E5E7EB]";

export function getDocumentBadgeStyles(tipDocument: string): string {
  const key = (tipDocument || "Document").toLowerCase();
  return BADGE_STYLES[key] ?? DEFAULT_BADGE;
}

export function DocumentBadge({ tipDocument }: { tipDocument: string }) {
  const tip = tipDocument || "Document";
  return (
    <span
      className={`inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${getDocumentBadgeStyles(tip)}`}
    >
      {tip}
    </span>
  );
}

export function getYearMetaLabel(selectedYear: number, currentYear: number): string {
  if (selectedYear === currentYear) return "An curent";
  if (selectedYear === currentYear - 1) return "Arhivă";
  return `An ${selectedYear}`;
}
