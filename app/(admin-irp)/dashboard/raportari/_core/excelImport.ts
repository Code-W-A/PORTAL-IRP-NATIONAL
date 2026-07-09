import type { CellValue, Worksheet } from "exceljs";
import { format } from "date-fns";

import { createId } from "@/app/(admin-irp)/dashboard/raportari/_core/firestore";
import { getOrderedColumns } from "@/app/(admin-irp)/dashboard/raportari/_core/export";
import {
  parseRowDateCell,
  serializeRowDateCell,
} from "@/app/(admin-irp)/dashboard/raportari/_core/rowDateCell";
import { ACTIVITATI_IMPACT_TYPE_ID } from "@/app/(admin-irp)/dashboard/raportari/_core/templates/activitatiImpact";
import { propagateUnitateOnRows } from "@/app/(admin-irp)/dashboard/raportari/_core/templates/shared";
import { parsePeriodFromReportTitle } from "@/app/(admin-irp)/dashboard/raportari/_core/title";
import type { ReportRowDoc, ReportTypeColumn } from "@/app/(admin-irp)/dashboard/raportari/_core/types";

export type ExcelImportResult = {
  periodStart: string | null;
  periodEnd: string | null;
  title: string | null;
  rows: ReportRowDoc[];
  warnings: string[];
};

type ColumnMapping = {
  columnId: string;
  colNumber: number;
};

type DetectedLayout = {
  title: string | null;
  headerRowNumber: number;
  mappings: ColumnMapping[];
  isPortalExport: boolean;
};

const HEADER_SCAN_ROWS = 15;
const TITLE_SCAN_ROWS = 12;

function normalizeHeaderText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cellValueToRawString(value: CellValue | null | undefined): string {
  if (value == null) return "";

  if (value instanceof Date) {
    return format(value, "yyyy-MM-dd");
  }

  if (typeof value === "number") {
    if (value > 20000 && value < 80000) {
      const utcDays = Math.floor(value - 25569);
      const date = new Date(utcDays * 86400 * 1000);
      if (!Number.isNaN(date.getTime())) {
        return format(date, "yyyy-MM-dd");
      }
    }
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }

  if (typeof value === "object") {
    if ("formula" in value || "sharedFormula" in value) {
      const result = "result" in value ? value.result : null;
      return cellValueToRawString(result as CellValue);
    }
    if ("text" in value && value.text && typeof value.text === "object") {
      const nestedText = cellValueToRawString(value.text as CellValue);
      if (nestedText) return nestedText;
    }
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text || "").join("").trim();
    }
    if ("text" in value && typeof value.text === "string") {
      return value.text.trim();
    }
    if ("hyperlink" in value && typeof value.hyperlink === "string") {
      const hyperlinkText = cellValueToRawString(
        "text" in value ? (value.text as CellValue) : null
      );
      return hyperlinkText || value.hyperlink.trim();
    }
  }

  return String(value).trim();
}

function getCellString(worksheet: Worksheet, rowNumber: number, colNumber: number) {
  const cell = worksheet.getRow(rowNumber).getCell(colNumber);
  return cellValueToRawString(cell.value);
}

function getRowStrings(worksheet: Worksheet, rowNumber: number, maxCols = 20) {
  const row = worksheet.getRow(rowNumber);
  const values: string[] = [];
  for (let col = 1; col <= maxCols; col += 1) {
    values.push(cellValueToRawString(row.getCell(col).value));
  }
  return values;
}

function isNoteRow(values: string[]) {
  return values.some((value) => normalizeHeaderText(value).startsWith("NOTA:"));
}

function resolveColumnIdFromHeader(header: string, columns: ReportTypeColumn[]): string | null {
  const normalized = normalizeHeaderText(header);
  if (!normalized || normalized === "NR CRT" || normalized === "NR. CRT") {
    return null;
  }

  for (const column of columns) {
    const columnLabel = normalizeHeaderText(column.label);
    if (normalized === columnLabel || normalized.includes(columnLabel) || columnLabel.includes(normalized)) {
      return column.id;
    }
  }

  if (normalized.includes("UNITATE")) return "unitate";
  if (normalized.includes("DATA") || normalized.includes("PERIOADA")) return "data";
  if (normalized.includes("DESCRIERE") || normalized.includes("ACTIVITATE")) {
    const match = columns.find((column) => column.id === "descriere" || column.id === "activitate");
    return match?.id || null;
  }
  if (normalized.includes("LINK") || normalized.includes("TRANSFER") || normalized.includes("TRASNFER")) {
    return columns.find((column) => column.id === "linkTransfer")?.id || null;
  }
  if (normalized.includes("MODALITATE")) return "modalitate";
  if (normalized.includes("PERSOANE")) return "persoane";
  if (normalized.includes("OBSERVATII")) return "observatii";

  return null;
}

function findTitle(worksheet: Worksheet): string | null {
  for (let rowNumber = 1; rowNumber <= TITLE_SCAN_ROWS; rowNumber += 1) {
    const values = getRowStrings(worksheet, rowNumber);
    for (const value of values) {
      const normalized = normalizeHeaderText(value);
      if (
        normalized.includes("PERIOADA") ||
        normalized.includes("ACTIVITATEA DE IMPACT") ||
        normalized.includes("INTENTII DE MEDIATIZARE")
      ) {
        return value.trim();
      }
    }
  }
  return null;
}

function detectLayout(worksheet: Worksheet, columns: ReportTypeColumn[]): DetectedLayout | null {
  const title = findTitle(worksheet);
  let bestRow = -1;
  let bestMappings: ColumnMapping[] = [];
  let isPortalExport = false;

  for (let rowNumber = 1; rowNumber <= HEADER_SCAN_ROWS; rowNumber += 1) {
    const values = getRowStrings(worksheet, rowNumber);
    const mappings: ColumnMapping[] = [];
    let portalHeader = false;

    values.forEach((value, index) => {
      const colNumber = index + 1;
      const normalized = normalizeHeaderText(value);
      if (normalized === "NR CRT" || normalized === "NR. CRT") {
        portalHeader = true;
        return;
      }
      const columnId = resolveColumnIdFromHeader(value, columns);
      if (columnId && !mappings.some((mapping) => mapping.columnId === columnId)) {
        mappings.push({ columnId, colNumber });
      }
    });

    if (mappings.length > bestMappings.length) {
      bestRow = rowNumber;
      bestMappings = mappings;
      isPortalExport = portalHeader;
    }
  }

  if (bestRow < 0 || bestMappings.length < 2) {
    return null;
  }

  return {
    title,
    headerRowNumber: bestRow,
    mappings: bestMappings,
    isPortalExport,
  };
}

function normalizeImportedDateValue(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const parsed = parseRowDateCell(trimmed);
  if (parsed.mode === "single" && parsed.start) {
    return parsed.start;
  }
  if (parsed.mode === "range" && parsed.start && parsed.end) {
    return serializeRowDateCell("range", parsed.start, parsed.end);
  }

  return trimmed;
}

function extractYearHint(rows: Array<Record<string, string>>): number | undefined {
  const years: number[] = [];

  for (const row of rows) {
    const parsed = parseRowDateCell(String(row.data || ""));
    if (parsed.start) {
      const year = Number(parsed.start.slice(0, 4));
      if (year >= 2000 && year <= 2100) {
        years.push(year);
      }
    }
  }

  if (!years.length) return undefined;
  return Math.max(...years);
}

function buildRowsFromSheet(
  worksheet: Worksheet,
  layout: DetectedLayout,
  columns: ReportTypeColumn[]
): { rows: ReportRowDoc[]; warnings: string[] } {
  const warnings: string[] = [];
  const orderedColumns = getOrderedColumns(columns);
  const rawRows: Array<Record<string, string>> = [];
  let emptyAfterData = 0;

  for (let rowNumber = layout.headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const rowValues = getRowStrings(worksheet, rowNumber);
    if (isNoteRow(rowValues)) break;

    const cells: Record<string, string> = {};
    for (const mapping of layout.mappings) {
      const raw = rowValues[mapping.colNumber - 1] || "";
      const column = orderedColumns.find((item) => item.id === mapping.columnId);
      cells[mapping.columnId] =
        column?.kind === "date_flexible" || mapping.columnId === "data"
          ? normalizeImportedDateValue(raw)
          : raw.trim();
    }

    const hasContent = layout.mappings.some((mapping) => String(cells[mapping.columnId] || "").trim());
    if (!hasContent) {
      if (rawRows.length > 0) {
        emptyAfterData += 1;
        if (emptyAfterData >= 2) break;
      }
      continue;
    }

    emptyAfterData = 0;
    rawRows.push(cells);
  }

  if (!rawRows.length) {
    warnings.push("Nu s-au găsit rânduri cu date în fișier.");
    return { rows: [], warnings };
  }

  const rows = propagateUnitateOnRows(
    rawRows.map((cells) => ({
      id: createId(),
      cells,
    }))
  );

  return { rows, warnings };
}

export async function parseExcelReportFile(
  buffer: ArrayBuffer,
  typeId: string,
  columnsSnapshot: ReportTypeColumn[]
): Promise<ExcelImportResult> {
  const warnings: string[] = [];
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return {
      periodStart: null,
      periodEnd: null,
      title: null,
      rows: [],
      warnings: ["Fișierul Excel nu conține foi de calcul."],
    };
  }

  const columns = getOrderedColumns(columnsSnapshot);
  const layout = detectLayout(worksheet, columns);
  if (!layout) {
    return {
      periodStart: null,
      periodEnd: null,
      title: null,
      rows: [],
      warnings: ["Nu am putut detecta rândul de antet (UNITATEA / DATA / etc.)."],
    };
  }

  if (!layout.title) {
    warnings.push("Titlul raportului nu a fost găsit; perioada trebuie setată manual.");
  }

  const mappedColumnIds = new Set(layout.mappings.map((mapping) => mapping.columnId));
  for (const column of columns) {
    if (!mappedColumnIds.has(column.id) && column.required) {
      warnings.push(`Coloana obligatorie „${column.label}” nu a fost găsită în antet.`);
    }
  }

  if (layout.isPortalExport) {
    warnings.push("Detectat layout export portal (Nr. crt.).");
  }

  const { rows, warnings: rowWarnings } = buildRowsFromSheet(worksheet, layout, columns);
  warnings.push(...rowWarnings);

  const hintYear = extractYearHint(rows.map((row) => row.cells));
  const parsedPeriod = layout.title
    ? parsePeriodFromReportTitle(layout.title, typeId, hintYear)
    : null;

  if (layout.title && !parsedPeriod) {
    warnings.push("Perioada din titlu nu a putut fi interpretată; verifică manual datele de început/sfârșit.");
  }

  if (typeId === ACTIVITATI_IMPACT_TYPE_ID && parsedPeriod && !hintYear) {
    warnings.push("Anul perioadei a fost dedus din anul curent (titlul nu conține an).");
  }

  return {
    periodStart: parsedPeriod?.periodStart ?? null,
    periodEnd: parsedPeriod?.periodEnd ?? null,
    title: layout.title,
    rows,
    warnings,
  };
}
