"use client";

import { Copy, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { getOrderedColumns } from "@/app/(admin-irp)/dashboard/raportari/_core/export";
import { formatRowDateCellDisplay } from "@/app/(admin-irp)/dashboard/raportari/_core/rowDateCell";
import type { ReportRowDoc, ReportTypeColumn } from "@/app/(admin-irp)/dashboard/raportari/_core/types";
import RowDateCellEditor from "@/app/(admin-irp)/dashboard/raportari/RowDateCellEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type Props = {
  columns: ReportTypeColumn[];
  rows: ReportRowDoc[];
  reportPeriodStart?: string;
  reportPeriodEnd?: string;
  autocompleteByColumn?: Record<string, string[]>;
  onChange: (rows: ReportRowDoc[]) => void;
  onAddRow: () => void;
  onDuplicateRow: (index: number) => void;
};

export default function ReportRowsEditor({
  columns,
  rows,
  reportPeriodStart,
  reportPeriodEnd,
  autocompleteByColumn = {},
  onChange,
  onAddRow,
  onDuplicateRow,
}: Props) {
  const orderedColumns = useMemo(() => getOrderedColumns(columns), [columns]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);

  function updateCell(rowIndex: number, columnId: string, value: string) {
    onChange(
      rows.map((row, index) =>
        index === rowIndex
          ? {
              ...row,
              cells: {
                ...row.cells,
                [columnId]: value,
              },
            }
          : row
      )
    );
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, rowIndex) => rowIndex !== index));
  }

  function openTextareaEditor(rowIndex: number, column: ReportTypeColumn) {
    setEditingIndex(rowIndex);
    setEditingColumnId(column.id);
    setSheetOpen(true);
  }

  const editingColumn =
    editingColumnId != null ? orderedColumns.find((column) => column.id === editingColumnId) : null;
  const editingValue =
    editingIndex != null && editingColumnId
      ? String(rows[editingIndex]?.cells[editingColumnId] || "")
      : "";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-gray-600">
          Editează direct în tabel. Coloanele lungi se deschid într-un panou lateral.
        </div>
        <Button onClick={onAddRow}>
          <Plus className="h-4 w-4" />
          Adaugă rând
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-200 text-gray-800">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Nr. crt.</th>
              {orderedColumns.map((column) => (
                <th key={column.id} className="min-w-[180px] px-3 py-2 text-left font-semibold">
                  {column.label}
                  {column.required ? <span className="ml-1 text-red-600">*</span> : null}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-semibold">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-center text-gray-500" colSpan={orderedColumns.length + 2}>
                  Nu există rânduri încă. Apasă „Adaugă rând” sau „Preia săptămâna trecută”.
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => (
                <tr key={row.id} className="border-t border-gray-200 align-top">
                  <td className="px-3 py-2 text-gray-500">{rowIndex + 1}</td>
                  {orderedColumns.map((column) => {
                    const value = String(row.cells[column.id] || "");
                    const suggestions = autocompleteByColumn[column.id] || [];

                    if (column.kind === "textarea") {
                      return (
                        <td key={`${row.id}:${column.id}`} className="px-3 py-2">
                          <button
                            type="button"
                            className="min-h-[72px] w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-left text-sm hover:border-blue-300"
                            onClick={() => openTextareaEditor(rowIndex, column)}
                          >
                            {value || "Click pentru editare..."}
                          </button>
                        </td>
                      );
                    }

                    if (column.kind === "date_flexible" || column.id === "data") {
                      return (
                        <td key={`${row.id}:${column.id}`} className="px-3 py-2">
                          <RowDateCellEditor
                            value={value}
                            reportPeriodStart={reportPeriodStart}
                            reportPeriodEnd={reportPeriodEnd}
                            onChange={(nextValue) => updateCell(rowIndex, column.id, nextValue)}
                          />
                          {value ? (
                            <div className="mt-1 text-xs text-gray-500">{formatRowDateCellDisplay(value)}</div>
                          ) : null}
                        </td>
                      );
                    }

                    return (
                      <td key={`${row.id}:${column.id}`} className="px-3 py-2">
                        <Input
                          value={value}
                          list={suggestions.length ? `suggestions-${column.id}` : undefined}
                          onChange={(event) => updateCell(rowIndex, column.id, event.target.value)}
                          placeholder={column.label}
                        />
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="outline" size="sm" onClick={() => onDuplicateRow(rowIndex)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => removeRow(rowIndex)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {orderedColumns.map((column) => {
        const suggestions = autocompleteByColumn[column.id] || [];
        if (!suggestions.length) return null;
        return (
          <datalist key={`list-${column.id}`} id={`suggestions-${column.id}`}>
            {suggestions.map((value) => (
              <option key={value} value={value} />
            ))}
          </datalist>
        );
      })}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{editingColumn?.label || "Editare"}</SheetTitle>
            <SheetDescription>Completează textul pentru rândul selectat.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            <textarea
              value={editingValue}
              onChange={(event) => {
                if (editingIndex == null || !editingColumnId) return;
                updateCell(editingIndex, editingColumnId, event.target.value);
              }}
              className="min-h-[320px] w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
            />
            <div className="flex justify-end">
              <Button onClick={() => setSheetOpen(false)}>Gata</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
