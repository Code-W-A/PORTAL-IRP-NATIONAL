import type { Bicp } from "@/app/(admin-irp)/lista-BICP/hooks/useBicpData";

export function getBicpDisplayLabel(item: Bicp) {
  if (item.numeAfisare) return item.numeAfisare;
  const numar = item.numarComunicat ?? item.numar;
  const tip = item.nume || item.tip;
  return `${numar}-${tip}-${item.titlu}`.trim();
}
