import { buildIntentiiMediatizareTitle } from "@/app/(admin-irp)/dashboard/raportari/_core/title";
import type { ReportTypeColumn, ReportTypeDoc } from "@/app/(admin-irp)/dashboard/raportari/_core/types";

import { DEFAULT_UNITATE_LABEL } from "./shared";

export const INTENTII_MEDIATIZARE_TYPE_ID = "intentii-mediatizare";

export { DEFAULT_UNITATE_LABEL };

const ACTIVITATE_LABEL =
  "Activitatea planificată pentru a fi mediatizată (campanii, conferințe de presă/declarații de presă pe diferite subiecte, evenimente publice, exerciții etc.)";

const MODALITATE_LABEL =
  "Modalitatea de mediatizare (conferințe, declarații, comunicate, buletine, postări pe rețelele sociale/site etc.)";

const PERSOANE_LABEL =
  "Persoanele care susțin conferința de presă/declarația de presă, dacă este cazul";

export const INTENTII_MEDIATIZARE_COLUMNS: ReportTypeColumn[] = [
  { id: "unitate", label: "Unitatea", kind: "text", width: "s", required: false, order: 0 },
  { id: "data", label: "Data", kind: "date_flexible", width: "m", required: false, order: 1 },
  { id: "activitate", label: ACTIVITATE_LABEL, kind: "textarea", width: "l", required: true, order: 2 },
  { id: "modalitate", label: MODALITATE_LABEL, kind: "textarea", width: "l", required: false, order: 3 },
  { id: "persoane", label: PERSOANE_LABEL, kind: "text", width: "m", required: false, order: 4 },
  { id: "observatii", label: "Observații", kind: "text", width: "m", required: false, order: 5 },
];

export const INTENTII_MEDIATIZARE_TYPE: Omit<ReportTypeDoc, "createdAt" | "updatedAt"> = {
  id: INTENTII_MEDIATIZARE_TYPE_ID,
  name: "Intenții mediatizare",
  description: "Raport săptămânal privind intențiile de mediatizare a activităților planificate.",
  columns: INTENTII_MEDIATIZARE_COLUMNS,
  archived: false,
};

export { buildIntentiiMediatizareTitle };

export function getDefaultIntentiiRowCells(options: {
  unitate?: string;
  dataLabel?: string;
  dataIso?: string;
  persoane?: string;
}) {
  return {
    unitate: options.unitate || DEFAULT_UNITATE_LABEL,
    data: options.dataIso || options.dataLabel || "",
    activitate: "",
    modalitate: "",
    persoane: options.persoane || "Purtător de cuvânt",
    observatii: "",
  };
}

/** @deprecated Use getDefaultIntentiiRowCells */
export const getDefaultRowCells = getDefaultIntentiiRowCells;
