import type { Filters } from "@/app/(admin-irp)/lista-BICP/hooks/useBicpData";

export function countAdvancedBicpFilters(filters: Filters): number {
  return [
    filters.tipDocument,
    filters.semnatarCat,
    filters.numeSemnatar,
    filters.grad,
    filters.functia,
    filters.pentru,
    filters.purtatorCuvant,
    filters.numarMin,
    filters.numarMax,
    filters.dataStart,
    filters.dataEnd,
  ].filter((value) => value !== undefined && value !== null && value !== "").length;
}