"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs } from "firebase/firestore";

import { getBicpDisplayLabel } from "@/app/(admin-irp)/statistici-interventii/_core/bicpLabel";
import type { Bicp } from "@/app/(admin-irp)/lista-BICP/hooks/useBicpData";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";
import type { InterventionRecordDraft } from "@/types/interventionStats";
import { todayIsoDate, ymdFromIso } from "@/utils/interventionStats";

type Props = {
  open: boolean;
  typeName: string;
  typeId: string;
  title?: string;
  submitLabel?: string;
  initialDraft?: Partial<InterventionRecordDraft>;
  onOpenChange: (open: boolean) => void;
  onSubmit: (draft: InterventionRecordDraft) => Promise<void>;
};

export function InterventionRecordDialog({
  open,
  typeName,
  typeId,
  title,
  submitLabel = "Salvează",
  initialDraft,
  onOpenChange,
  onSubmit,
}: Props) {
  const { db } = initFirebase();
  const [bicpItems, setBicpItems] = useState<Bicp[]>([]);
  const [bicpLoading, setBicpLoading] = useState(false);
  const [bicpSearch, setBicpSearch] = useState("");
  const [occurredYmd, setOccurredYmd] = useState(ymdFromIso(todayIsoDate()));
  const [communicated, setCommunicated] = useState(false);
  const [bicpComunicatId, setBicpComunicatId] = useState<string | undefined>();
  const [bicpComunicatLabel, setBicpComunicatLabel] = useState<string | undefined>();
  const [showBicpPicker, setShowBicpPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredBicp = useMemo(() => {
    const query = bicpSearch.trim().toLowerCase();
    const base = bicpItems.slice(0, 100);
    if (!query) return base;
    return base.filter((item) => getBicpDisplayLabel(item).toLowerCase().includes(query));
  }, [bicpItems, bicpSearch]);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      setBicpLoading(true);
      try {
        const { judetId, structuraId } = getTenantContext();
        const snap = await getDocs(
          collection(doc(db, `Judete/${judetId}/Structuri/${structuraId}`), "Comunicate")
        );
        const data = snap.docs.map((item) => ({ id: item.id, ...(item.data() as object) })) as Bicp[];
        data.sort((a, b) => Number(b.numarComunicat ?? b.numar ?? 0) - Number(a.numarComunicat ?? a.numar ?? 0));
        setBicpItems(data);
      } finally {
        setBicpLoading(false);
      }
    })();
  }, [db, open]);

  useEffect(() => {
    if (!open) return;
    setOccurredYmd(ymdFromIso(initialDraft?.occurredAt || todayIsoDate()));
    setCommunicated(!!initialDraft?.communicated);
    setBicpComunicatId(initialDraft?.bicpComunicatId);
    setBicpComunicatLabel(initialDraft?.bicpComunicatLabel);
    setShowBicpPicker(false);
    setError(null);
  }, [initialDraft, open]);

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        typeId,
        occurredAt: new Date(`${occurredYmd}T12:00:00`).toISOString(),
        communicated,
        bicpComunicatId: communicated ? bicpComunicatId : undefined,
        bicpComunicatLabel: communicated ? bicpComunicatLabel : undefined,
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu s-a putut salva.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title || `Înregistrare: ${typeName}`}</DialogTitle>
          <DialogDescription>Completați data intervenției și, dacă e cazul, asocierea cu un comunicat BICP.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-gray-600">Data intervenției</label>
            <Input type="date" value={occurredYmd} onChange={(e) => setOccurredYmd(e.target.value)} />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="communicated"
              checked={communicated}
              onCheckedChange={(checked) => {
                const value = checked === true;
                setCommunicated(value);
                if (!value) {
                  setBicpComunicatId(undefined);
                  setBicpComunicatLabel(undefined);
                }
              }}
            />
            <label htmlFor="communicated" className="text-sm font-medium text-gray-900">
              Comunicat
            </label>
          </div>

          {communicated ? (
            <div className="space-y-2 rounded-lg border border-gray-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-gray-600">Comunicat BICP (opțional)</span>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowBicpPicker((v) => !v)}>
                  {showBicpPicker ? "Ascunde listă" : "Selectează"}
                </Button>
              </div>
              <p className="text-sm text-gray-900">{bicpComunicatLabel || "Niciun comunicat asociat"}</p>
              {bicpComunicatLabel ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-600"
                  onClick={() => {
                    setBicpComunicatId(undefined);
                    setBicpComunicatLabel(undefined);
                  }}
                >
                  Elimină asocierea
                </Button>
              ) : null}

              {showBicpPicker ? (
                <div className="space-y-2">
                  <Input
                    value={bicpSearch}
                    onChange={(e) => setBicpSearch(e.target.value)}
                    placeholder="Caută comunicat..."
                  />
                  {bicpLoading ? (
                    <p className="text-sm text-gray-500">Se încarcă...</p>
                  ) : filteredBicp.length === 0 ? (
                    <p className="text-sm text-gray-500">Niciun comunicat găsit.</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto rounded-md border border-gray-200">
                      {filteredBicp.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="block w-full border-b border-gray-100 px-3 py-2 text-left text-sm hover:bg-gray-50"
                          onClick={() => {
                            setBicpComunicatId(item.id);
                            setBicpComunicatLabel(getBicpDisplayLabel(item));
                            setShowBicpPicker(false);
                          }}
                        >
                          {getBicpDisplayLabel(item)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Anulează
            </Button>
            <Button type="button" onClick={() => void handleSubmit()} disabled={busy}>
              {busy ? "..." : submitLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
