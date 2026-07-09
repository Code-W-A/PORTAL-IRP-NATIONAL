import type { ReportTypeColumn, ReportTypeDoc } from "@/app/(admin-irp)/dashboard/raportari/_core/types";

import { DEFAULT_UNITATE_LABEL } from "./shared";

export const ACTIVITATI_IMPACT_TYPE_ID = "activitati-impact";

export const ACTIVITATI_IMPACT_FOOTNOTE =
  "NOTĂ: Va fi completată o singură activitate, cea mai importantă/relevantă din perioada la care face referire raportarea.";

const DATA_LABEL =
  "DATA/PERIOADA când a avut loc activitatea/ misiunea/ evenimentul";

const DESCRIERE_LABEL = "DESCRIEREA misiunii/activității/evenimentului";

const LINK_LABEL =
  "LINK DE TRASNFER AL IMAGINILOR VIDEO transmise prin platforma http://www.transfer.mai.intranet/";

export const ACTIVITATI_IMPACT_COLUMNS: ReportTypeColumn[] = [
  { id: "unitate", label: "UNITATEA", kind: "text", width: "s", required: false, order: 0 },
  { id: "data", label: DATA_LABEL, kind: "date_flexible", width: "m", required: false, order: 1 },
  { id: "descriere", label: DESCRIERE_LABEL, kind: "textarea", width: "l", required: true, order: 2 },
  { id: "linkTransfer", label: LINK_LABEL, kind: "text", width: "l", required: false, order: 3 },
];

export const ACTIVITATI_IMPACT_TYPE: Omit<ReportTypeDoc, "createdAt" | "updatedAt"> = {
  id: ACTIVITATI_IMPACT_TYPE_ID,
  name: "Activități de impact",
  description: "Raport periodic privind activitatea de impact cea mai relevantă din perioada selectată.",
  columns: ACTIVITATI_IMPACT_COLUMNS,
  archived: false,
};

export function getDefaultImpactRowCells(options: {
  unitate?: string;
  dataLabel?: string;
  dataIso?: string;
}) {
  return {
    unitate: options.unitate || DEFAULT_UNITATE_LABEL,
    data: options.dataIso || options.dataLabel || "",
    descriere: "",
    linkTransfer: "",
  };
}
