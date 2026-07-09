"use client";

import { User } from "lucide-react";
import { useEffect, useState } from "react";
import type { Filters } from "@/app/(admin-irp)/lista-BICP/hooks/useBicpData";
import { btnAccent, btnSecondary, inputBase, selectBase } from "@/app/(admin-irp)/lista-BICP/constants/ui";

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

export function AdvancedFiltersPanel({
  filters,
  setFilters,
  onApplied,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  onApplied?: () => void;
}) {
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleApply = () => {
    setFilters({ ...localFilters, page: 1 });
    onApplied?.();
  };

  const handleReset = () => {
    const resetFilters: Filters = {
      ...localFilters,
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
    setLocalFilters(resetFilters);
    setFilters(resetFilters);
  };

  return (
    <div className="border-t border-[#E5E7EB] pt-3 mt-3 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <label className={fieldLabel}>Tip document</label>
          <select
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

        <div className="space-y-1.5">
          <label className={fieldLabel}>Data început</label>
          <input
            type="date"
            className={inputBase}
            value={localFilters.dataStart ?? ""}
            onChange={(e) =>
              setLocalFilters({ ...localFilters, dataStart: e.target.value || undefined })
            }
          />
        </div>

        <div className="space-y-1.5">
          <label className={fieldLabel}>Data sfârșit</label>
          <input
            type="date"
            className={inputBase}
            value={localFilters.dataEnd ?? ""}
            onChange={(e) =>
              setLocalFilters({ ...localFilters, dataEnd: e.target.value || undefined })
            }
          />
        </div>

        <div className="space-y-1.5">
          <label className={fieldLabel}>Număr minim</label>
          <input
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
          <label className={fieldLabel}>Număr maxim</label>
          <input
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

      <div className="border-t border-[#E5E7EB] pt-3">
        <h3 className="text-sm font-semibold text-[#111827] mb-3 flex items-center gap-2">
          <User size={15} className="text-[#64748B]" />
          Semnatar
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className={fieldLabel}>Nume semnatar</label>
            <input
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
            <label className={fieldLabel}>Grad</label>
            <input
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
            <label className={fieldLabel}>Funcția</label>
            <input
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
            <label className={fieldLabel}>Pentru</label>
            <input
              type="text"
              className={inputBase}
              value={localFilters.pentru ?? ""}
              onChange={(e) =>
                setLocalFilters({ ...localFilters, pentru: e.target.value || undefined })
              }
              placeholder="Ex: ISU"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2 lg:col-span-1">
            <label className={fieldLabel}>Purtător de cuvânt</label>
            <input
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
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <button type="button" className={btnSecondary} onClick={handleReset}>
          Resetează filtre
        </button>
        <button type="button" className={btnAccent} onClick={handleApply}>
          Aplică filtre
        </button>
      </div>
    </div>
  );
}
