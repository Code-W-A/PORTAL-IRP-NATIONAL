export const BICP_DOCX_VARIANTS = [
  { value: "simple", label: "DOCX simplu", suffix: "simplu" },
  { value: "public", label: "DOCX complet fără semnături", suffix: "fara_semnaturi" },
  { value: "signed", label: "DOCX complet cu semnături", suffix: "cu_semnaturi" },
] as const;

export type BicpDocxVariant = (typeof BICP_DOCX_VARIANTS)[number]["value"];

export function parseBicpDocxVariant(value: string | null): BicpDocxVariant | null {
  if (value === null) return "signed";
  return BICP_DOCX_VARIANTS.find((variant) => variant.value === value)?.value ?? null;
}
