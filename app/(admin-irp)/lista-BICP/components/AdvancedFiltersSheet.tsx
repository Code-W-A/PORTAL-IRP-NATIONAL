"use client";

import { Calendar, FileText, Filter, Hash, User } from "lucide-react";
import { useEffect, useState } from "react";

import { countAdvancedBicpFilters } from "@/app/(admin-irp)/lista-BICP/filters";
import type { Filters } from "@/app/(admin-irp)/lista-BICP/hooks/useBicpData";
import { btnAccent, btnSecondary, inputBase, selectBase } from "@/app/(admin-irp)/lista-BICP/constants/ui";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const DOCUMENT_TYPES = [
  "Buletin Informativ",
  "Comunicat de Presă",
  "Știre",
  "Declarație de presă",
  "Conferință de presă",
  "Invitație",
  "Interviu",
  "Anunț",
  "Eveniment de presă",
  "Drept la replică",
];

const fieldLabel = "text-xs font-medium text-[#64748B]";
const sectionTitle = "text-sm font-semibold text-[#111827] flex items-center gap-2";

function advancedResetBase(filters: Filters): Filters {
  return {
    ...filters,
    tipDocument: "",
    semnatarCat: "",
    numarMin: undefined,
    numarMax: undefined,
    dataStart: undefined,
    dataEnd: undefined,
    numeSemnatar: "",
    grad: "",
    functia: "",
    pentru: "",
    purtatorCuvant: "",
    page: 1,
  };
}

export function AdvancedFiltersSheet({
  open,
  onOpenChange,
  filters,
  setFilters,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Filters;
  setFilters: (f: Filters) => void;
}) {
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    if (open) setLocalFilters(filters);
  }, [open, filters]);

  const activeCount = countAdvancedBicpFilters(localFilters);

  const handleApply = () => {
    setFilters({ ...localFilters, page: 1 });
    onOpenChange(false);
  };

  const handleReset = () => {
    const resetFilters = advancedResetBase(localFilters);
    setLocalFilters(resetFilters);
    setFilters(resetFilters);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-md">
        <div className="border-b border-[#E5E7EB] bg-[#F8FAFC] px-6 pb-4 pt-6 pr-12">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <Filter size={18} className="text-[#1D4ED8]" aria-hidden />
              Filtre avansate
            </SheetTitle>
            <SheetDescription>
              {activeCount > 0
                ? `${activeCount} ${activeCount === 1 ? "filtru activ" : "filtre active"} în acest panou`
                : "Niciun filtru avansat selectat"}
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <section className="space-y-3">
            <h3 className={sectionTitle}>
              <FileText size={16} className="text-[#64748B]" aria-hidden />
              Document
            </h3>
            <div className="space-y-1.5">
              <label className={fieldLabel} htmlFor="bicp-filter-tip">
                Tip document
              </label>
              <select
                id="bicp-filter-tip"
                className={selectBase}
                value={localFilters.tipDocument}
                onChange={(e) => setLocalFilters({ ...localFilters, tipDocument: e.target.value })}
              >
                <option value="">Toate tipurile</option>
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="space-y-3 border-t border-[#E5E7EB] pt-5">
            <h3 className={sectionTitle}>
              <Calendar size={16} className="text-[#64748B]" aria-hidden />
              Interval date
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className={fieldLabel} htmlFor="bicp-filter-start">
                  Data început
                </label>
                <input
                  id="bicp-filter-start"
                  type="date"
                  className={inputBase}
                  value={localFilters.dataStart ?? ""}
                  onChange={(e) =>
                    setLocalFilters({ ...localFilters, dataStart: e.target.value || undefined })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className={fieldLabel} htmlFor="bicp-filter-end">
                  Data sfârșit
                </label>
                <input
                  id="bicp-filter-end"
                  type="date"
                  className={inputBase}
                  value={localFilters.dataEnd ?? ""}
                  onChange={(e) =>
                    setLocalFilters({ ...localFilters, dataEnd: e.target.value || undefined })
                  }
                />
              </div>
            </div>
          </section>

          <section className="space-y-3 border-t border-[#E5E7EB] pt-5">
            <h3 className={sectionTitle}>
              <Hash size={16} className="text-[#64748B]" aria-hidden />
              Interval numere
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className={fieldLabel} htmlFor="bicp-filter-min">
                  Număr minim
                </label>
                <input
                  id="bicp-filter-min"
                  type="number"
                  className={inputBase}
                  value={localFilters.numarMin ?? ""}
                  onChange={(e) =>
                    setLocalFilters({
                      ...localFilters,
                      numarMin: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  placeholder="Ex: 1"
                />
              </div>
              <div className="space-y-1.5">
                <label className={fieldLabel} htmlFor="bicp-filter-max">
                  Număr maxim
                </label>
                <input
                  id="bicp-filter-max"
                  type="number"
                  className={inputBase}
                  value={localFilters.numarMax ?? ""}
                  onChange={(e) =>
                    setLocalFilters({
                      ...localFilters,
                      numarMax: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  placeholder="Ex: 100"
                />
              </div>
            </div>
          </section>

          <section className="space-y-3 border-t border-[#E5E7EB] pt-5">
            <h3 className={sectionTitle}>
              <User size={16} className="text-[#64748B]" aria-hidden />
              Semnatar și purtător
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <label className={fieldLabel} htmlFor="bicp-filter-nume">
                  Nume semnatar
                </label>
                <input
                  id="bicp-filter-nume"
                  type="text"
                  className={inputBase}
                  value={localFilters.numeSemnatar ?? ""}
                  onChange={(e) =>
                    setLocalFilters({ ...localFilters, numeSemnatar: e.target.value || undefined })
                  }
                  placeholder="Ex: Popescu, Ion"
                />
              </div>
              <div className="space-y-1.5">
                <label className={fieldLabel} htmlFor="bicp-filter-grad">
                  Grad
                </label>
                <input
                  id="bicp-filter-grad"
                  type="text"
                  className={inputBase}
                  value={localFilters.grad ?? ""}
                  onChange={(e) =>
                    setLocalFilters({ ...localFilters, grad: e.target.value || undefined })
                  }
                  placeholder="Ex: Colonel"
                />
              </div>
              <div className="space-y-1.5">
                <label className={fieldLabel} htmlFor="bicp-filter-functia">
                  Funcția
                </label>
                <input
                  id="bicp-filter-functia"
                  type="text"
                  className={inputBase}
                  value={localFilters.functia ?? ""}
                  onChange={(e) =>
                    setLocalFilters({ ...localFilters, functia: e.target.value || undefined })
                  }
                  placeholder="Ex: Inspector Șef"
                />
              </div>
              <div className="space-y-1.5">
                <label className={fieldLabel} htmlFor="bicp-filter-pentru">
                  Pentru
                </label>
                <input
                  id="bicp-filter-pentru"
                  type="text"
                  className={inputBase}
                  value={localFilters.pentru ?? ""}
                  onChange={(e) =>
                    setLocalFilters({ ...localFilters, pentru: e.target.value || undefined })
                  }
                  placeholder="Ex: ISU"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className={fieldLabel} htmlFor="bicp-filter-purtator">
                  Purtător de cuvânt
                </label>
                <input
                  id="bicp-filter-purtator"
                  type="text"
                  className={inputBase}
                  value={localFilters.purtatorCuvant ?? ""}
                  onChange={(e) =>
                    setLocalFilters({ ...localFilters, purtatorCuvant: e.target.value || undefined })
                  }
                  placeholder="Nume purtător de cuvânt"
                />
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-2 border-t border-[#E5E7EB] bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" className={`${btnSecondary} w-full sm:w-auto`} onClick={handleReset}>
            Resetează
          </button>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className={`${btnSecondary} w-full sm:w-auto`}
              onClick={() => onOpenChange(false)}
            >
              Anulează
            </button>
            <button type="button" className={`${btnAccent} w-full sm:w-auto`} onClick={handleApply}>
              Aplică filtrele
              {activeCount > 0 ? (
                <span className="ml-1.5 rounded-full bg-white/25 px-1.5 py-0.5 text-xs">{activeCount}</span>
              ) : null}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}