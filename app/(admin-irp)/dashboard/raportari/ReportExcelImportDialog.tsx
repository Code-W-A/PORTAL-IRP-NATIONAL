"use client";

import { FileSpreadsheet, Loader2 } from "lucide-react";
import { useRef, useState } from "react";

import {
  parseExcelReportFile,
  type ExcelImportResult,
} from "@/app/(admin-irp)/dashboard/raportari/_core/excelImport";
import { formatPeriodRangeLabel } from "@/app/(admin-irp)/dashboard/raportari/_core/title";
import { formatRowDateCellDisplay } from "@/app/(admin-irp)/dashboard/raportari/_core/rowDateCell";
import type { ReportRowDoc, ReportTypeColumn } from "@/app/(admin-irp)/dashboard/raportari/_core/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

type Props = {
  open: boolean;
  typeId: string;
  columnsSnapshot: ReportTypeColumn[];
  onClose: () => void;
  onApply: (payload: {
    periodStart: string;
    periodEnd: string;
    rows: ReportRowDoc[];
  }) => void;
};

function truncate(value: string, max = 80) {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export default function ReportExcelImportDialog({
  open,
  typeId,
  columnsSnapshot,
  onClose,
  onApply,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExcelImportResult | null>(null);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  function resetState() {
    setLoading(false);
    setError(null);
    setResult(null);
    setPeriodStart("");
    setPeriodEnd("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleClose() {
    resetState();
    onClose();
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const parsed = await parseExcelReportFile(buffer, typeId, columnsSnapshot);
      setResult(parsed);
      setPeriodStart(parsed.periodStart || "");
      setPeriodEnd(parsed.periodEnd || "");

      if (!parsed.rows.length && !parsed.periodStart) {
        setError("Fișierul nu conține date importabile.");
      }
    } catch {
      setError("Nu am putut citi fișierul Excel. Verifică formatul (.xlsx).");
    } finally {
      setLoading(false);
    }
  }

  function handleApply() {
    if (!result?.rows.length) return;
    if (!periodStart || !periodEnd) {
      setError("Completează perioada înainte de aplicare.");
      return;
    }
    if (periodStart > periodEnd) {
      setError("Data de început trebuie să fie înainte de data de sfârșit.");
      return;
    }

    onApply({
      periodStart,
      periodEnd,
      rows: result.rows,
    });
    handleClose();
  }

  const previewColumns = columnsSnapshot
    .filter((column) => ["unitate", "data", "descriere", "activitate", "linkTransfer"].includes(column.id))
    .slice(0, 4);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Excel</DialogTitle>
          <DialogDescription>
            Încarcă fișierul descărcat din Google Sheet (.xlsx). Perioada și rândurile vor fi detectate automat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(event) => void handleFileChange(event)}
            />
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => fileInputRef.current?.click()}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              {loading ? "Se analizează..." : "Alege fișier Excel"}
            </Button>
          </div>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
          ) : null}

          {result ? (
            <div className="space-y-4">
              {result.title ? (
                <div className="rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-800">{result.title}</div>
              ) : null}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700" htmlFor="import-period-start">
                    Perioadă început
                  </label>
                  <Input
                    id="import-period-start"
                    type="date"
                    value={periodStart}
                    onChange={(event) => setPeriodStart(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700" htmlFor="import-period-end">
                    Perioadă sfârșit
                  </label>
                  <Input
                    id="import-period-end"
                    type="date"
                    value={periodEnd}
                    onChange={(event) => setPeriodEnd(event.target.value)}
                  />
                </div>
              </div>

              {periodStart && periodEnd ? (
                <div className="text-sm text-gray-600">
                  Perioadă detectată: {formatPeriodRangeLabel(periodStart, periodEnd)}
                </div>
              ) : null}

              {result.warnings.length > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <div className="font-medium">Avertismente</div>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {result.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div>
                <div className="mb-2 text-sm font-medium text-gray-800">
                  {result.rows.length} rând(uri) detectat(e)
                </div>
                {result.rows.length > 0 ? (
                  <ScrollArea className="h-48 rounded-lg border">
                    <table className="w-full min-w-[520px] text-left text-xs">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-2 py-2">#</th>
                          {previewColumns.map((column) => (
                            <th key={column.id} className="px-2 py-2">
                              {column.id === "linkTransfer" ? "Link" : column.label.slice(0, 24)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.rows.map((row, index) => (
                          <tr key={row.id} className="border-t">
                            <td className="px-2 py-2">{index + 1}</td>
                            {previewColumns.map((column) => {
                              const raw = String(row.cells[column.id] || "");
                              const value =
                                column.kind === "date_flexible" || column.id === "data"
                                  ? formatRowDateCellDisplay(raw)
                                  : raw;
                              return (
                                <td key={`${row.id}:${column.id}`} className="px-2 py-2 align-top">
                                  {truncate(value) || "—"}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Anulează
          </Button>
          <Button
            type="button"
            disabled={!result?.rows.length || loading}
            onClick={handleApply}
          >
            Aplică import
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
