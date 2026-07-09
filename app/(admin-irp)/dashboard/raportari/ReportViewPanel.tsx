"use client";

import { useMemo } from "react";

import { getOrderedColumns } from "@/app/(admin-irp)/dashboard/raportari/_core/export";
import { formatCellValueForExport } from "@/app/(admin-irp)/dashboard/raportari/_core/rowDateCell";
import type { ReportDraft } from "@/app/(admin-irp)/dashboard/raportari/_core/reportDraft";
import {
  DEFAULT_UNITATE_LABEL,
  propagateUnitateOnRows,
} from "@/app/(admin-irp)/dashboard/raportari/_core/templates/shared";
import { formatPeriodRangeLabel } from "@/app/(admin-irp)/dashboard/raportari/_core/title";
import { shortColumnLabel } from "@/app/(admin-irp)/dashboard/raportari/_core/evidenta";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  report: ReportDraft;
};

export default function ReportViewPanel({ report }: Props) {
  const columns = useMemo(() => getOrderedColumns(report.columnsSnapshot), [report.columnsSnapshot]);
  const exportRows = useMemo(
    () => propagateUnitateOnRows(report.rows, DEFAULT_UNITATE_LABEL),
    [report.rows]
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{report.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-sm text-gray-600">
          <div>
            <span className="font-medium text-gray-800">Perioadă:</span>{" "}
            {formatPeriodRangeLabel(report.periodStart, report.periodEnd)}
          </div>
          <div>
            <span className="font-medium text-gray-800">Nr. înregistrare:</span>{" "}
            {report.registrationNumber || "—"}
          </div>
          <div>
            <span className="font-medium text-gray-800">Tip:</span> {report.typeNameSnapshot}
          </div>
          <Badge variant="secondary">{exportRows.length} rânduri</Badge>
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-200 text-gray-800">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Nr. crt.</th>
              {columns.map((column) => (
                <th key={column.id} className="min-w-[180px] px-3 py-2 text-left font-semibold">
                  {shortColumnLabel(column.label)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {exportRows.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-gray-500" colSpan={columns.length + 1}>
                  Nu există rânduri în această raportare.
                </td>
              </tr>
            ) : (
              exportRows.map((row, rowIndex) => (
                <tr key={row.id} className="border-t border-gray-200 align-top">
                  <td className="px-3 py-2 text-gray-500">{rowIndex + 1}</td>
                  {columns.map((column) => {
                    const raw = String(row.cells[column.id] || "").trim();
                    const value =
                      column.kind === "date_flexible" || column.id === "data"
                        ? formatCellValueForExport(raw, "date_flexible")
                        : raw;
                    return (
                      <td key={`${row.id}:${column.id}`} className="px-3 py-2 whitespace-pre-wrap">
                        {value || "—"}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
