"use client";

import { useMemo } from "react";

import {
  parseRowDateCell,
  serializeRowDateCell,
  type RowDateCellMode,
} from "@/app/(admin-irp)/dashboard/raportari/_core/rowDateCell";
import { Input } from "@/components/ui/input";

type Props = {
  value: string;
  reportPeriodStart?: string;
  reportPeriodEnd?: string;
  onChange: (value: string) => void;
};

export default function RowDateCellEditor({
  value,
  reportPeriodStart,
  reportPeriodEnd,
  onChange,
}: Props) {
  const parsed = useMemo(() => parseRowDateCell(value), [value]);
  const editorMode: Exclude<RowDateCellMode, "legacy" | "empty"> =
    parsed.mode === "range" ? "range" : "single";

  const startValue = parsed.start || "";
  const endValue = parsed.end || parsed.start || "";

  const outOfRange =
    reportPeriodStart &&
    reportPeriodEnd &&
    parsed.mode !== "legacy" &&
    parsed.mode !== "empty" &&
    parsed.start &&
    (parsed.mode === "single"
      ? parsed.start < reportPeriodStart || parsed.start > reportPeriodEnd
      : parsed.end
        ? parsed.start < reportPeriodStart || parsed.end > reportPeriodEnd
        : false);

  function setMode(nextMode: Exclude<RowDateCellMode, "legacy" | "empty">) {
    if (nextMode === "single") {
      onChange(serializeRowDateCell("single", startValue || reportPeriodStart || ""));
      return;
    }
    onChange(
      serializeRowDateCell(
        "range",
        startValue || reportPeriodStart || "",
        endValue || reportPeriodEnd || startValue || reportPeriodStart || ""
      )
    );
  }

  function updateStart(nextStart: string) {
    if (editorMode === "single") {
      onChange(serializeRowDateCell("single", nextStart));
      return;
    }
    onChange(serializeRowDateCell("range", nextStart, endValue || nextStart));
  }

  function updateEnd(nextEnd: string) {
    onChange(serializeRowDateCell("range", startValue || nextEnd, nextEnd));
  }

  if (parsed.mode === "legacy" && value.trim()) {
    return (
      <div className="space-y-2">
        <div className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
          Valoare veche: {parsed.display}. Alege un mod de mai jos pentru a converti.
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            className="rounded border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
            onClick={() => setMode("single")}
          >
            Dată
          </button>
          <button
            type="button"
            className="rounded border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
            onClick={() => setMode("range")}
          >
            Interval
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 min-w-[220px]">
      <div className="flex gap-1">
        <button
          type="button"
          className={`rounded border px-2 py-1 text-xs ${
            editorMode === "single" ? "border-blue-600 bg-blue-50 text-blue-800" : "border-gray-200"
          }`}
          onClick={() => setMode("single")}
        >
          Dată
        </button>
        <button
          type="button"
          className={`rounded border px-2 py-1 text-xs ${
            editorMode === "range" ? "border-blue-600 bg-blue-50 text-blue-800" : "border-gray-200"
          }`}
          onClick={() => setMode("range")}
        >
          Interval
        </button>
      </div>

      {editorMode === "single" ? (
        <Input
          type="date"
          value={startValue}
          onChange={(event) => updateStart(event.target.value)}
          aria-label="Data activității"
        />
      ) : (
        <div className="grid grid-cols-1 gap-2">
          <Input
            type="date"
            value={startValue}
            onChange={(event) => updateStart(event.target.value)}
            aria-label="Data început activitate"
          />
          <Input
            type="date"
            value={endValue}
            onChange={(event) => updateEnd(event.target.value)}
            aria-label="Data sfârșit activitate"
          />
        </div>
      )}

      {outOfRange ? (
        <p className="text-xs text-amber-700">Data este în afara perioadei raportului.</p>
      ) : null}
    </div>
  );
}
