import type { ReportRowDoc, ReportTypeColumn } from "./types";
import { formatCellValueForExport } from "./rowDateCell";

export function widthWeight(width: ReportTypeColumn["width"]) {
  if (width === "s") return 1;
  if (width === "l") return 3;
  return 2;
}

export function getOrderedColumns(columns: ReportTypeColumn[]) {
  return [...columns].sort((a, b) => a.order - b.order);
}

export function buildTableHeaders(columns: ReportTypeColumn[]) {
  return ["Nr. crt.", ...getOrderedColumns(columns).map((column) => column.label)];
}

export function buildTableRowValues(
  row: ReportRowDoc,
  rowIndex: number,
  columns: ReportTypeColumn[]
): string[] {
  return [
    String(rowIndex + 1),
    ...getOrderedColumns(columns).map((column) =>
      formatCellValueForExport(
        String(row.cells[column.id] || ""),
        column.kind === "date_flexible" || column.id === "data" ? "date_flexible" : column.kind
      )
    ),
  ];
}
