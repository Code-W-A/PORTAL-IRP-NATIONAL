"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  PublicInfoRequest,
  PublicInfoRequestDraft,
  PublicInfoRequestOptions,
  PublicInfoRequestType,
} from "@/app/(admin-irp)/registru-informatii-publice/_core/types";
import {
  validatePublicInfoDraft,
  validatePublicInfoWarnings,
} from "@/app/(admin-irp)/registru-informatii-publice/_core/firestore";
import { suggestNextRequestNumber } from "@/app/(admin-irp)/registru-informatii-publice/_core/requestNumber";
import { REQUESTER_TYPE_LABELS } from "@/app/(admin-irp)/registru-informatii-publice/_core/types";

export type PublicInfoFormMode = "create-written" | "create-verbal" | "edit";

type PublicInfoRequestFormProps = {
  open: boolean;
  mode: PublicInfoFormMode;
  initialRequest?: PublicInfoRequest | null;
  allRequests: PublicInfoRequest[];
  options: PublicInfoRequestOptions;
  submitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    draft: PublicInfoRequestDraft,
    saveOptions: Record<string, boolean>
  ) => Promise<void>;
};

function isoToDateInput(iso: string) {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return "";
  const date = new Date(parsed);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dateInputToIso(value: string) {
  if (!value) return new Date().toISOString();
  return new Date(`${value}T12:00:00`).toISOString();
}

function buildPresetDraft(
  mode: PublicInfoFormMode,
  allRequests: PublicInfoRequest[]
): PublicInfoRequestDraft {
  const requestType: PublicInfoRequestType =
    mode === "create-verbal" ? "verbal" : "written";

  return {
    requestNumber: suggestNextRequestNumber(allRequests),
    requestDate: new Date().toISOString(),
    requestType,
    receiveMethod: requestType === "verbal" ? "verbal" : "e-mail",
    requesterName: "",
    requesterType: "person_fizica",
    requestedInformation: "",
    interestDomain: "",
    responseNature: "în lucru",
    communicationMethod: requestType === "verbal" ? "verbal" : "e-mail",
    termDays: undefined,
    responseNumber: "",
    responseDate: undefined,
    internalNotes: "",
  };
}

export default function PublicInfoRequestForm({
  open,
  mode,
  initialRequest,
  allRequests,
  options,
  submitting = false,
  onOpenChange,
  onSave,
}: PublicInfoRequestFormProps) {
  const [draft, setDraft] = useState<PublicInfoRequestDraft>(() =>
    buildPresetDraft(mode, allRequests)
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [saveForLater, setSaveForLater] = useState({
    receiveMethod: false,
    interestDomain: false,
    responseNature: false,
    communicationMethod: false,
    requestedInformation: false,
    requesterName: false,
  });

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initialRequest) {
      setDraft({
        requestNumber: initialRequest.requestNumber,
        requestDate: initialRequest.requestDate,
        requestType: initialRequest.requestType,
        receiveMethod: initialRequest.receiveMethod,
        requesterName: initialRequest.requesterName,
        requesterType: initialRequest.requesterType,
        requestedInformation: initialRequest.requestedInformation,
        interestDomain: initialRequest.interestDomain,
        responseNature: initialRequest.responseNature,
        communicationMethod: initialRequest.communicationMethod,
        termDays: initialRequest.termDays,
        responseNumber: initialRequest.responseNumber,
        responseDate: initialRequest.responseDate,
        internalNotes: initialRequest.internalNotes,
      });
    } else {
      setDraft(buildPresetDraft(mode, allRequests));
    }
    setErrors([]);
    setWarnings([]);
    setSaveForLater({
      receiveMethod: false,
      interestDomain: false,
      responseNature: false,
      communicationMethod: false,
      requestedInformation: false,
      requesterName: false,
    });
  }, [open, mode, initialRequest, allRequests]);

  const title = useMemo(() => {
    if (mode === "edit") return "Editează solicitarea";
    if (mode === "create-verbal") return "Adaugă solicitare verbală";
    return "Adaugă solicitare scrisă";
  }, [mode]);

  async function handleSubmit(addAnother: boolean) {
    const nextErrors = validatePublicInfoDraft(draft);
    const nextWarnings = validatePublicInfoWarnings(draft);
    setErrors(nextErrors);
    setWarnings(nextWarnings);
    if (nextErrors.length) return;

    await onSave(draft, saveForLater);
    if (addAnother) {
      setDraft(buildPresetDraft(mode, allRequests));
      setErrors([]);
      setWarnings([]);
      return;
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Completează rapid câmpurile registrului. Poți salva valori frecvente pentru autocomplete.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Număr cerere">
            <Input
              value={draft.requestNumber}
              onChange={(event) => setDraft((prev) => ({ ...prev, requestNumber: event.target.value }))}
              placeholder="Ex: 20/2026"
            />
          </Field>

          <Field label="Data cererii *">
            <Input
              type="date"
              value={isoToDateInput(draft.requestDate)}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, requestDate: dateInputToIso(event.target.value) }))
              }
            />
          </Field>

          <AutocompleteField
            label="Modalitate primire *"
            value={draft.receiveMethod}
            options={options.receiveMethods}
            onChange={(value) => setDraft((prev) => ({ ...prev, receiveMethod: value }))}
            saveChecked={saveForLater.receiveMethod}
            onSaveCheckedChange={(checked) =>
              setSaveForLater((prev) => ({ ...prev, receiveMethod: checked }))
            }
          />

          <Field label="Tip solicitant *">
            <select
              value={draft.requesterType}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  requesterType: event.target.value as PublicInfoRequestDraft["requesterType"],
                }))
              }
              className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
            >
              {Object.entries(REQUESTER_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          <AutocompleteField
            label="Solicitant *"
            value={draft.requesterName}
            options={options.frequentRequesters}
            onChange={(value) => setDraft((prev) => ({ ...prev, requesterName: value }))}
            saveChecked={saveForLater.requesterName}
            onSaveCheckedChange={(checked) =>
              setSaveForLater((prev) => ({ ...prev, requesterName: checked }))
            }
            placeholder="Anonim / Nespecificat"
          />

          <AutocompleteField
            label="Domeniul de interes"
            value={draft.interestDomain}
            options={options.interestDomains}
            onChange={(value) => setDraft((prev) => ({ ...prev, interestDomain: value }))}
            saveChecked={saveForLater.interestDomain}
            onSaveCheckedChange={(checked) =>
              setSaveForLater((prev) => ({ ...prev, interestDomain: checked }))
            }
          />

          <AutocompleteField
            label="Natura răspunsului"
            value={draft.responseNature}
            options={options.responseNatures}
            onChange={(value) => setDraft((prev) => ({ ...prev, responseNature: value }))}
            saveChecked={saveForLater.responseNature}
            onSaveCheckedChange={(checked) =>
              setSaveForLater((prev) => ({ ...prev, responseNature: checked }))
            }
          />

          <AutocompleteField
            label="Mod comunicare răspuns"
            value={draft.communicationMethod}
            options={options.communicationMethods}
            onChange={(value) => setDraft((prev) => ({ ...prev, communicationMethod: value }))}
            saveChecked={saveForLater.communicationMethod}
            onSaveCheckedChange={(checked) =>
              setSaveForLater((prev) => ({ ...prev, communicationMethod: checked }))
            }
          />

          <Field label="Termen (zile)">
            <Input
              type="number"
              min={0}
              value={draft.termDays ?? ""}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  termDays: event.target.value ? Number(event.target.value) : undefined,
                }))
              }
            />
          </Field>

          <Field label="Număr răspuns">
            <Input
              value={draft.responseNumber || ""}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, responseNumber: event.target.value }))
              }
            />
          </Field>

          <Field label="Data răspunsului">
            <Input
              type="date"
              value={draft.responseDate ? isoToDateInput(draft.responseDate) : ""}
              onChange={(event) =>
                setDraft((prev) => ({
                  ...prev,
                  responseDate: event.target.value ? dateInputToIso(event.target.value) : undefined,
                }))
              }
            />
          </Field>
        </div>

        <Field label="Informațiile solicitate *">
          <textarea
            value={draft.requestedInformation}
            onChange={(event) =>
              setDraft((prev) => ({ ...prev, requestedInformation: event.target.value }))
            }
            rows={4}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
          />
          <label className="mt-2 flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={saveForLater.requestedInformation}
              onChange={(event) =>
                setSaveForLater((prev) => ({ ...prev, requestedInformation: event.target.checked }))
              }
            />
            Salvează textul pentru utilizări viitoare
          </label>
        </Field>

        <Field label="Observații interne">
          <textarea
            value={draft.internalNotes || ""}
            onChange={(event) => setDraft((prev) => ({ ...prev, internalNotes: event.target.value }))}
            rows={2}
            className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
          />
        </Field>

        {errors.length ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errors.map((item) => (
              <div key={item}>{item}</div>
            ))}
          </div>
        ) : null}

        {warnings.length ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {warnings.map((item) => (
              <div key={item}>{item}</div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Anulează
          </Button>
          <Button variant="outline" onClick={() => void handleSubmit(true)} disabled={submitting}>
            Salvează și adaugă alta
          </Button>
          <Button onClick={() => void handleSubmit(false)} disabled={submitting}>
            {submitting ? "Se salvează..." : "Salvează"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );
}

function AutocompleteField({
  label,
  value,
  options,
  onChange,
  saveChecked,
  onSaveCheckedChange,
  placeholder,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  saveChecked: boolean;
  onSaveCheckedChange: (checked: boolean) => void;
  placeholder?: string;
}) {
  const listId = `${label.replace(/\s+/g, "-").toLowerCase()}-options`;

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        list={listId}
        placeholder={placeholder}
      />
      <datalist id={listId}>
        {options.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>
      <label className="flex items-center gap-2 text-xs text-gray-600">
        <input
          type="checkbox"
          checked={saveChecked}
          onChange={(event) => onSaveCheckedChange(event.target.checked)}
        />
        Salvează pentru utilizări viitoare
      </label>
    </div>
  );
}
