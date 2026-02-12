"use client";

import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActivityEvent, ActivityEventDraft, ActivityRecurrence, RecurrenceFrequency } from "@/app/(admin-irp)/calendar-activitati/types";
import {
  BUCHAREST_TIMEZONE,
  dateInputToIsoEndExclusive,
  dateInputToIsoEndOfDay,
  dateInputToIsoStart,
  datetimeLocalInputToIso,
  isoToDateInput,
  isoToDateTimeLocalInput,
  isoToInclusiveDateInputFromExclusiveEnd,
  weekdayFromIso,
} from "@/app/(admin-irp)/calendar-activitati/utils/datetime";

const WEEKDAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: "L" },
  { value: 2, label: "Ma" },
  { value: 3, label: "Mi" },
  { value: 4, label: "J" },
  { value: 5, label: "V" },
  { value: 6, label: "S" },
  { value: 0, label: "D" },
];

export type ActivityModalSeed = {
  allDay: boolean;
  startDate: string;
  endDate: string;
  startDateTime: string;
  endDateTime: string;
};

type ActivityModalProps = {
  open: boolean;
  mode: "create" | "edit";
  initialEvent?: ActivityEvent | null;
  seed?: ActivityModalSeed | null;
  submitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (draft: ActivityEventDraft) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
};

type FormState = {
  title: string;
  description: string;
  allDay: boolean;
  startDate: string;
  endDate: string;
  startDateTime: string;
  endDateTime: string;
  location: string;
  category: string;
  color: string;
  repeatEnabled: boolean;
  recurrenceFreq: RecurrenceFrequency;
  recurrenceInterval: string;
  recurrenceUntilDate: string;
  recurrenceWeekDays: number[];
};

function buildDefaultSeed(): ActivityModalSeed {
  const now = DateTime.now().setZone(BUCHAREST_TIMEZONE).plus({ minutes: 15 });
  const roundedStart = now.startOf("minute").set({ minute: Math.floor(now.minute / 15) * 15 });
  const roundedEnd = roundedStart.plus({ hours: 1 });

  return {
    allDay: false,
    startDate: roundedStart.toFormat("yyyy-LL-dd"),
    endDate: roundedEnd.toFormat("yyyy-LL-dd"),
    startDateTime: roundedStart.toFormat("yyyy-LL-dd'T'HH:mm"),
    endDateTime: roundedEnd.toFormat("yyyy-LL-dd'T'HH:mm"),
  };
}

function buildFormState(mode: "create" | "edit", initialEvent?: ActivityEvent | null, seed?: ActivityModalSeed | null): FormState {
  const safeSeed = seed || buildDefaultSeed();

  if (mode === "edit" && initialEvent) {
    const recurrence = initialEvent.recurrence;
    const recurrenceFreq = recurrence?.freq || "none";
    const recurrenceWeekDays = recurrence?.byWeekDays?.length
      ? recurrence.byWeekDays
      : [weekdayFromIso(initialEvent.startDateTime)];

    return {
      title: initialEvent.title || "",
      description: initialEvent.description || "",
      allDay: initialEvent.allDay === true,
      startDate: isoToDateInput(initialEvent.startDateTime),
      endDate: isoToInclusiveDateInputFromExclusiveEnd(initialEvent.endDateTime),
      startDateTime: isoToDateTimeLocalInput(initialEvent.startDateTime),
      endDateTime: isoToDateTimeLocalInput(initialEvent.endDateTime),
      location: initialEvent.location || "",
      category: initialEvent.category || "",
      color: initialEvent.color || "#2563eb",
      repeatEnabled: recurrenceFreq !== "none",
      recurrenceFreq,
      recurrenceInterval: String(recurrence?.interval || 1),
      recurrenceUntilDate: recurrence?.until ? isoToDateInput(recurrence.until) : "",
      recurrenceWeekDays,
    };
  }

  return {
    title: "",
    description: "",
    allDay: safeSeed.allDay,
    startDate: safeSeed.startDate,
    endDate: safeSeed.endDate,
    startDateTime: safeSeed.startDateTime,
    endDateTime: safeSeed.endDateTime,
    location: "",
    category: "",
    color: "#2563eb",
    repeatEnabled: false,
    recurrenceFreq: "none",
    recurrenceInterval: "1",
    recurrenceUntilDate: "",
    recurrenceWeekDays: safeSeed.startDateTime
      ? [resolveSeedWeekday(safeSeed.startDateTime, "yyyy-LL-dd'T'HH:mm")]
      : [resolveSeedWeekday(safeSeed.startDate, "yyyy-LL-dd")],
  };
}

function ensureValidWeekdays(days: number[], fallback: number) {
  const unique = Array.from(new Set(days.filter((value) => value >= 0 && value <= 6))).sort(
    (left, right) => left - right
  );
  return unique.length ? unique : [fallback];
}

function resolveSeedWeekday(seedValue: string, format: string) {
  const parsed = DateTime.fromFormat(seedValue, format, {
    zone: BUCHAREST_TIMEZONE,
    setZone: true,
  });
  if (!parsed.isValid) return 1;
  return parsed.weekday % 7;
}

export default function ActivityModal({
  open,
  mode,
  initialEvent,
  seed,
  submitting = false,
  onOpenChange,
  onSave,
  onDelete,
}: ActivityModalProps) {
  const [formState, setFormState] = useState<FormState>(() =>
    buildFormState(mode, initialEvent, seed)
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFormState(buildFormState(mode, initialEvent, seed));
    setError(null);
  }, [open, mode, initialEvent, seed]);

  const formTitle = mode === "edit" ? "Editează activitatea" : "Adaugă activitate";
  const formDescription =
    mode === "edit"
      ? "Actualizează detaliile activității selectate."
      : "Completează detaliile pentru activitatea nouă.";

  const startIsoPreview = useMemo(() => {
    if (formState.allDay) {
      return dateInputToIsoStart(formState.startDate);
    }
    return datetimeLocalInputToIso(formState.startDateTime);
  }, [formState.allDay, formState.startDate, formState.startDateTime]);

  function toggleWeekday(day: number) {
    setFormState((prev) => {
      const exists = prev.recurrenceWeekDays.includes(day);
      const next = exists
        ? prev.recurrenceWeekDays.filter((item) => item !== day)
        : [...prev.recurrenceWeekDays, day];
      const fallback = startIsoPreview ? weekdayFromIso(startIsoPreview) : 1;
      return {
        ...prev,
        recurrenceWeekDays: ensureValidWeekdays(next, fallback),
      };
    });
  }

  async function handleSubmit() {
    setError(null);

    const title = formState.title.trim();
    if (!title) {
      setError("Titlul este obligatoriu.");
      return;
    }

    let startDateTime: string | null;
    let endDateTime: string | null;

    if (formState.allDay) {
      if (!formState.startDate || !formState.endDate) {
        setError("Completează data de început și data de sfârșit.");
        return;
      }

      startDateTime = dateInputToIsoStart(formState.startDate);
      endDateTime = dateInputToIsoEndExclusive(formState.endDate);

      if (!startDateTime || !endDateTime) {
        setError("Datele selectate nu sunt valide.");
        return;
      }

      const start = DateTime.fromISO(startDateTime, { setZone: true });
      const end = DateTime.fromISO(endDateTime, { setZone: true });
      if (end <= start) {
        setError("Data de sfârșit trebuie să fie după data de început.");
        return;
      }
    } else {
      if (!formState.startDateTime || !formState.endDateTime) {
        setError("Completează data și ora de început/sfârșit.");
        return;
      }

      startDateTime = datetimeLocalInputToIso(formState.startDateTime);
      endDateTime = datetimeLocalInputToIso(formState.endDateTime);

      if (!startDateTime || !endDateTime) {
        setError("Datele selectate nu sunt valide.");
        return;
      }

      const start = DateTime.fromISO(startDateTime, { setZone: true });
      const end = DateTime.fromISO(endDateTime, { setZone: true });
      if (end <= start) {
        setError("Ora de sfârșit trebuie să fie după ora de început.");
        return;
      }
    }

    const startForRule = DateTime.fromISO(startDateTime, { setZone: true }).setZone(
      BUCHAREST_TIMEZONE
    );

    let recurrence: ActivityRecurrence | undefined;
    if (formState.repeatEnabled && formState.recurrenceFreq !== "none") {
      const interval = Math.max(1, Number(formState.recurrenceInterval || 1));
      recurrence = {
        freq: formState.recurrenceFreq,
        interval,
      };

      if (formState.recurrenceFreq === "weekly") {
        recurrence.byWeekDays = ensureValidWeekdays(
          formState.recurrenceWeekDays,
          startForRule.weekday % 7
        );
      }

      if (formState.recurrenceFreq === "monthly" || formState.recurrenceFreq === "yearly") {
        recurrence.byMonthDay = startForRule.day;
      }

      if (formState.recurrenceUntilDate) {
        const untilIso = dateInputToIsoEndOfDay(formState.recurrenceUntilDate);
        if (!untilIso) {
          setError("Data de final pentru recurență nu este validă.");
          return;
        }
        recurrence.until = untilIso;
      }
    }

    const draft: ActivityEventDraft = {
      title,
      description: formState.description.trim() || undefined,
      startDateTime,
      endDateTime,
      allDay: formState.allDay,
      location: formState.location.trim() || undefined,
      category: formState.category.trim() || undefined,
      color: formState.color || undefined,
      recurrence,
    };

    await onSave(draft);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-0">
        <div className="border-b border-gray-200 px-6 py-4">
          <DialogHeader>
            <DialogTitle>{formTitle}</DialogTitle>
            <DialogDescription>{formDescription}</DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 py-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Titlu *</label>
            <Input
              value={formState.title}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, title: event.target.value }))
              }
              placeholder="Ex: Ședință de coordonare"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Descriere</label>
            <textarea
              value={formState.description}
              onChange={(event) =>
                setFormState((prev) => ({ ...prev, description: event.target.value }))
              }
              rows={3}
              className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              placeholder="Detalii activitate"
            />
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <label className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={formState.allDay}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, allDay: event.target.checked }))
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              Toată ziua
            </label>

            {formState.allDay ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Început</label>
                  <Input
                    type="date"
                    value={formState.startDate}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, startDate: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Sfârșit</label>
                  <Input
                    type="date"
                    value={formState.endDate}
                    onChange={(event) =>
                      setFormState((prev) => ({ ...prev, endDate: event.target.value }))
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Început</label>
                  <Input
                    type="datetime-local"
                    value={formState.startDateTime}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        startDateTime: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-600">Sfârșit</label>
                  <Input
                    type="datetime-local"
                    value={formState.endDateTime}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        endDateTime: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Locație</label>
              <Input
                value={formState.location}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, location: event.target.value }))
                }
                placeholder="Ex: Sala de ședințe"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Categorie</label>
              <Input
                value={formState.category}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, category: event.target.value }))
                }
                placeholder="Ex: Intern"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Culoare</label>
              <Input
                type="color"
                value={formState.color}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, color: event.target.value }))
                }
                className="h-10 p-1"
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <label className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={formState.repeatEnabled}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    repeatEnabled: event.target.checked,
                    recurrenceFreq: event.target.checked ? prev.recurrenceFreq : "none",
                  }))
                }
                className="h-4 w-4 rounded border-gray-300"
              />
              Repetă
            </label>

            {formState.repeatEnabled && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Frecvență</label>
                    <select
                      value={formState.recurrenceFreq}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          recurrenceFreq: event.target.value as RecurrenceFrequency,
                        }))
                      }
                      className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
                    >
                      <option value="none">Fără repetare</option>
                      <option value="daily">Zilnic</option>
                      <option value="weekly">Săptămânal</option>
                      <option value="monthly">Lunar</option>
                      <option value="yearly">Anual</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">La fiecare</label>
                    <Input
                      type="number"
                      min={1}
                      value={formState.recurrenceInterval}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          recurrenceInterval: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Până la (opțional)</label>
                    <Input
                      type="date"
                      value={formState.recurrenceUntilDate}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          recurrenceUntilDate: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                {formState.recurrenceFreq === "weekly" && (
                  <div>
                    <div className="mb-2 text-xs font-medium text-gray-600">În zilele</div>
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAY_OPTIONS.map((day) => {
                        const active = formState.recurrenceWeekDays.includes(day.value);
                        return (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => toggleWeekday(day.value)}
                            className={`rounded-md px-3 py-1 text-xs font-medium ${
                              active
                                ? "bg-blue-600 text-white"
                                : "border border-gray-200 bg-white text-gray-700"
                            }`}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {formState.recurrenceFreq === "yearly" && (
                  <div className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
                    Activitatea se repetă în fiecare an în aceeași dată.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 px-6 py-4">
          <div>
            {mode === "edit" && onDelete && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => void onDelete()}
                disabled={submitting}
              >
                Șterge
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Anulează
            </Button>
            <Button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting ? "Se salvează..." : "Salvează"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
