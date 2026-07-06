import ExcelJS from "exceljs";

import type { PublicInfoRequest } from "@/app/(admin-irp)/registru-informatii-publice/_core/types";
import {
  computePublicInfoStats,
  formatRequestDateLabel,
  formatRequestNumberDate,
  formatResponseNumberDate,
} from "@/app/(admin-irp)/registru-informatii-publice/_core/stats";
import { REQUESTER_TYPE_LABELS } from "@/app/(admin-irp)/registru-informatii-publice/_core/types";

const TITLE =
  "REGISTRU pentru înregistrarea solicitărilor și răspunsurilor privind accesul la informațiile de interes public";

const HEADERS = [
  "Număr și data cerere",
  "Modalitatea de primire a cererii",
  "Numele și prenumele solicitantului",
  "Persoană fizică / persoană juridică",
  "Informațiile solicitate",
  "Domeniul de interes",
  "Natura răspunsului",
  "Modul de comunicare",
  "Termen (zile)",
  "Număr și data răspuns",
];

function addDataSheet(workbook: ExcelJS.Workbook, sheetName: string, items: PublicInfoRequest[]) {
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = [
    { width: 22 },
    { width: 24 },
    { width: 28 },
    { width: 24 },
    { width: 44 },
    { width: 24 },
    { width: 24 },
    { width: 24 },
    { width: 12 },
    { width: 22 },
  ];

  sheet.mergeCells("A1:J1");
  sheet.getCell("A1").value = TITLE;
  sheet.getCell("A1").font = { bold: true, size: 13 };
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  const headerRow = sheet.getRow(3);
  headerRow.values = HEADERS;
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    cell.border = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    };
  });

  items.forEach((item) => {
    const row = sheet.addRow([
      formatRequestNumberDate(item),
      item.receiveMethod || "",
      item.requesterName || "",
      REQUESTER_TYPE_LABELS[item.requesterType],
      item.requestedInformation || "",
      item.interestDomain || "",
      item.responseNature || "",
      item.communicationMethod || "",
      item.termDays ?? "",
      formatResponseNumberDate(item),
    ]);

    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      cell.alignment = {
        horizontal: "left",
        vertical: "top",
        wrapText: colNumber === 5,
      };
    });
  });
}

function addStatsSheet(workbook: ExcelJS.Workbook, items: PublicInfoRequest[]) {
  const stats = computePublicInfoStats(items);
  const sheet = workbook.addWorksheet("Statistici");
  sheet.columns = [{ width: 34 }, { width: 18 }];

  const rows: Array<[string, string | number]> = [
    ["Total solicitări", stats.total],
    ["Solicitări scrise", stats.written],
    ["Solicitări verbale", stats.verbal],
    ["Medie termen (zile)", stats.averageTermDays ?? "—"],
  ];

  Object.entries(stats.byResponseNature).forEach(([label, count]) => {
    rows.push([`Natura răspunsului: ${label}`, count]);
  });

  stats.topInterestDomains.forEach((item) => {
    rows.push([`Top domeniu: ${item.label}`, item.count]);
  });

  rows.forEach(([label, value]) => sheet.addRow([label, value]));
}

export async function buildPublicInfoRequestsWorkbook(items: PublicInfoRequest[]) {
  const workbook = new ExcelJS.Workbook();
  addDataSheet(workbook, "Toate", items);
  addDataSheet(
    workbook,
    "Solicitări scrise",
    items.filter((item) => item.requestType === "written")
  );
  addDataSheet(
    workbook,
    "Solicitări verbale",
    items.filter((item) => item.requestType === "verbal")
  );
  addStatsSheet(workbook, items);
  return workbook;
}

export function buildPublicInfoExportFilename(filters: { year?: string; month?: string }) {
  if (filters.month) return `registru-informatii-publice-${filters.month}.xlsx`;
  if (filters.year) return `registru-informatii-publice-${filters.year}.xlsx`;
  const year = new Date().getFullYear();
  return `registru-informatii-publice-${year}.xlsx`;
}

export async function downloadPublicInfoRequestsExcel(
  items: PublicInfoRequest[],
  filename: string
) {
  const workbook = await buildPublicInfoRequestsWorkbook(items);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function monthKeyFromIso(isoDate: string) {
  const parsed = Date.parse(isoDate);
  if (!Number.isFinite(parsed)) return "";
  const date = new Date(parsed);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function yearKeyFromIso(isoDate: string) {
  const parsed = Date.parse(isoDate);
  if (!Number.isFinite(parsed)) return "";
  return String(new Date(parsed).getFullYear());
}

export function formatRequestDateLabelForExport(isoDate: string) {
  return formatRequestDateLabel(isoDate);
}
