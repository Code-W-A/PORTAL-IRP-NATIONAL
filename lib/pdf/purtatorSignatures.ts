export const PURTATOR_SIGNATURE_KEYS = ["RADU", "OVIDIU"] as const;

export type PurtatorSignatureKey = (typeof PURTATOR_SIGNATURE_KEYS)[number];

export const DEFAULT_PURTATOR_SIGNATURE_KEY: PurtatorSignatureKey = "RADU";

const SIGNATURE_PATH_BY_KEY: Record<PurtatorSignatureKey, string> = {
  RADU: "/SEMNATURI/RADU.png",
  OVIDIU: "/SEMNATURI/OVIDIU.png",
};

export const PURTATOR_SIGNATURE_OPTIONS: Array<{ key: PurtatorSignatureKey; label: string }> = [
  { key: "RADU", label: "RADU" },
  { key: "OVIDIU", label: "OVIDIU" },
];

export function isPurtatorSignatureKey(value: unknown): value is PurtatorSignatureKey {
  return typeof value === "string" && (PURTATOR_SIGNATURE_KEYS as readonly string[]).includes(value.toUpperCase());
}

export function normalizePurtatorSignatureKey(
  value: unknown,
  fallback: PurtatorSignatureKey = DEFAULT_PURTATOR_SIGNATURE_KEY
): PurtatorSignatureKey {
  const candidate = typeof value === "string" ? value.trim().toUpperCase() : "";
  return isPurtatorSignatureKey(candidate) ? candidate : fallback;
}

export function getPurtatorSignaturePath(key: unknown): string {
  const normalized = normalizePurtatorSignatureKey(key);
  return SIGNATURE_PATH_BY_KEY[normalized];
}

export function buildPurtatorSignatureUrl(key: unknown, origin: string): string {
  return new URL(getPurtatorSignaturePath(key), origin).toString();
}
