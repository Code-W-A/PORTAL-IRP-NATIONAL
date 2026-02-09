import type { StructuraSettings } from "@/lib/settings/getSettings";

export function getSignaturesFromSettings(settings?: StructuraSettings | null) {
  const semnatari = settings?.semnatari ?? [];
  const semnatarIndex =
    typeof settings?.semnatarIndex === "number" ? settings.semnatarIndex : 0;
  const purtatori = settings?.purtatori ?? [];
  const purtatorIndex =
    typeof settings?.purtatorIndex === "number" ? settings.purtatorIndex : 0;

  const aprobat = semnatari[semnatarIndex] || semnatari[0];
  const intocmit = purtatori[purtatorIndex] || purtatori[0];

  return { aprobat, intocmit };
}
