import ExcelJS from "exceljs";

import { getOrderedColumns } from "@/app/(admin-irp)/dashboard/raportari/_core/export";
import { getSignaturesFromSettings } from "@/app/(admin-irp)/dashboard/raportari/_core/settings";
import {
  ACTIVITATI_IMPACT_FOOTNOTE,
  ACTIVITATI_IMPACT_TYPE_ID,
} from "@/app/(admin-irp)/dashboard/raportari/_core/templates/activitatiImpact";
import {
  DEFAULT_UNITATE_LABEL,
  propagateUnitateOnRows,
} from "@/app/(admin-irp)/dashboard/raportari/_core/templates/shared";
import { formatCellValueForExport } from "@/app/(admin-irp)/dashboard/raportari/_core/rowDateCell";
import type { ReportInstanceDoc } from "@/app/(admin-irp)/dashboard/raportari/_core/types";
import type { StructuraSettings } from "@/lib/settings/getSettings";

function excelWidth(width: "s" | "m" | "l") {
  if (width === "s") return 20;
  if (width === "l") return 44;
  return 32;
}

function columnLetter(index: number) {
  let result = "";
  let n = index;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

export async function buildDynamicReportWorkbook(
  report: Omit<ReportInstanceDoc, "id" | "createdAt" | "updatedAt">,
  settings?: StructuraSettings | null,
  includeSignatures = true
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Raport");
  const columns = getOrderedColumns(report.columnsSnapshot);
  const exportRows = propagateUnitateOnRows(report.rows, DEFAULT_UNITATE_LABEL);

  sheet.columns = [
    { key: "nr", width: 8 },
    ...columns.map((column) => ({ key: column.id, width: excelWidth(column.width) })),
  ];

  const totalCols = columns.length + 1;
  const totalColLetter = columnLetter(totalCols);

  sheet.mergeCells(`A1:${totalColLetter}1`);
  sheet.getCell("A1").value = report.title.toUpperCase();
  sheet.getCell("A1").font = { bold: true, size: 13 };
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  sheet.getRow(1).height = 42;

  sheet.addRow([]);
  sheet.addRow([]);
  sheet.addRow([]);

  const headerRowIndex = 5;

  const headerRow = sheet.getRow(headerRowIndex);
  headerRow.values = ["Nr. crt.", ...columns.map((column) => column.label)];
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  headerRow.eachCell((cell, colNumber) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
    if (colNumber === 1) {
      cell.alignment = { horizontal: "center", vertical: "middle" };
    }
  });

  exportRows.forEach((row, rowIndex) => {
    const values = [
      rowIndex + 1,
      ...columns.map((column) =>
        formatCellValueForExport(String(row.cells[column.id] || ""), column.kind === "date_flexible" || column.id === "data" ? "date_flexible" : column.kind)
      ),
    ];
    const dataRow = sheet.addRow(values);

    dataRow.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      if (colNumber === 1) {
        cell.alignment = { horizontal: "center", vertical: "top" };
      } else {
        const column = columns[colNumber - 2];
        cell.alignment = {
          horizontal: "left",
          vertical: "top",
          wrapText: column?.kind === "textarea",
        };
      }
    });
  });

  if (exportRows.length === 0) {
    const row = sheet.addRow(["", ...Array(columns.length).fill("")]);
    row.getCell(2).value = "Nu există rânduri în raport.";
    row.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  }

  if (report.typeId === ACTIVITATI_IMPACT_TYPE_ID) {
    sheet.addRow([]);
    const noteRow = sheet.addRow([ACTIVITATI_IMPACT_FOOTNOTE]);
    sheet.mergeCells(`A${noteRow.number}:${totalColLetter}${noteRow.number}`);
    noteRow.getCell(1).font = { italic: true, size: 10 };
    noteRow.getCell(1).alignment = { horizontal: "left", vertical: "top", wrapText: true };
    noteRow.height = 36;
  }

  sheet.views = [{ state: "frozen", ySplit: headerRowIndex }];

  if (includeSignatures) {
    const { aprobat, intocmit } = getSignaturesFromSettings(settings);
    const signaturesStartRow = sheet.rowCount + 3;

    const leftStart = "A";
    const leftEnd = columnLetter(Math.max(1, Math.floor(totalCols / 2)));
    const rightStart = columnLetter(Math.max(1, Math.floor(totalCols / 2) + 1));
    const rightEnd = totalColLetter;

    sheet.mergeCells(`${leftStart}${signaturesStartRow}:${leftEnd}${signaturesStartRow}`);
    sheet.mergeCells(`${rightStart}${signaturesStartRow}:${rightEnd}${signaturesStartRow}`);
    sheet.getCell(`${leftStart}${signaturesStartRow}`).value = "ÎNTOCMIT,";
    sheet.getCell(`${rightStart}${signaturesStartRow}`).value = "APROBAT,";
    sheet.getCell(`${leftStart}${signaturesStartRow}`).font = { bold: true };
    sheet.getCell(`${rightStart}${signaturesStartRow}`).font = { bold: true };

    sheet.mergeCells(`${leftStart}${signaturesStartRow + 1}:${leftEnd}${signaturesStartRow + 1}`);
    sheet.mergeCells(`${rightStart}${signaturesStartRow + 1}:${rightEnd}${signaturesStartRow + 1}`);
    sheet.getCell(`${leftStart}${signaturesStartRow + 1}`).value = intocmit?.nume || "";
    sheet.getCell(`${rightStart}${signaturesStartRow + 1}`).value = aprobat?.functia || "";

    sheet.mergeCells(`${leftStart}${signaturesStartRow + 2}:${leftEnd}${signaturesStartRow + 2}`);
    sheet.mergeCells(`${rightStart}${signaturesStartRow + 2}:${rightEnd}${signaturesStartRow + 2}`);
    sheet.getCell(`${leftStart}${signaturesStartRow + 2}`).value = "Semnătură: ____________";
    sheet.getCell(`${rightStart}${signaturesStartRow + 2}`).value = [aprobat?.grad, aprobat?.nume].filter(Boolean).join(" ");

    sheet.mergeCells(`${rightStart}${signaturesStartRow + 3}:${rightEnd}${signaturesStartRow + 3}`);
    sheet.getCell(`${rightStart}${signaturesStartRow + 3}`).value = "Semnătură: ____________";
  }

  return workbook;
}
