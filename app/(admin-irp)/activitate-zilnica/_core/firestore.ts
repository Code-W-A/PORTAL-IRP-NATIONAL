import {
  Timestamp,
  collection,
  doc,
  type Firestore,
} from "firebase/firestore";

import { getTenantContext } from "@/lib/tenant";
import type {
  AprobatSignature,
  DailyActivityItem,
  DailyActivityReport,
  DailyActivityTemplate,
  IntocmitSignature,
} from "./types";

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asTimestampMillis(value: unknown) {
  if (value && typeof value === "object" && "toMillis" in value) {
    try {
      return Number((value as any).toMillis?.() || 0);
    } catch {}
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

export function todayYmd() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fallbackDateFromTimestamp(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value) {
    try {
      const dt = (value as any).toDate?.() as Date | undefined;
      if (dt && !Number.isNaN(dt.getTime())) {
        const yyyy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, "0");
        const dd = String(dt.getDate()).padStart(2, "0");
        return `${yyyy}-${mm}-${dd}`;
      }
    } catch {}
  }
  return todayYmd();
}

export function buildReportTimestamp(reportDate: string) {
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(reportDate)
    ? reportDate
    : todayYmd();
  return Timestamp.fromDate(new Date(`${safeDate}T00:00:00`));
}

export function normalizeActivityItem(raw: any, index: number): DailyActivityItem {
  return {
    id: asString(raw?.id) || createId(),
    // Backward compatibility: old docs used "ora".
    intervalOrar: asString(raw?.intervalOrar || raw?.ora),
    activitate: asString(raw?.activitate),
    executant: asString(raw?.executant),
    observatii: asString(raw?.observatii),
  };
}

function normalizeIntocmit(raw: any): IntocmitSignature {
  return {
    nume: asString(raw?.nume),
  };
}

function normalizeAprobat(raw: any): AprobatSignature {
  return {
    functia: asString(raw?.functia),
    grad: asString(raw?.grad),
    nume: asString(raw?.nume),
  };
}

export function normalizeReportDoc(raw: any, id: string): DailyActivityReport {
  const activitiesRaw: any[] = Array.isArray(raw?.activities) ? raw.activities : [];

  return {
    id,
    reportDate:
      asString(raw?.reportDate) || fallbackDateFromTimestamp(raw?.reportTimestamp),
    reportTimestamp:
      raw?.reportTimestamp && typeof raw.reportTimestamp === "object"
        ? raw.reportTimestamp
        : buildReportTimestamp(
            asString(raw?.reportDate) || fallbackDateFromTimestamp(raw?.reportTimestamp)
          ),
    title: asString(raw?.title) || "Activitate zilnică",
    registrationNumber: asString(raw?.registrationNumber),
    activities: activitiesRaw.map((item: any, index: number) =>
      normalizeActivityItem(item, index)
    ),
    intocmit: normalizeIntocmit(raw?.intocmit),
    aprobat: normalizeAprobat(raw?.aprobat),
    templateId:
      raw?.templateId === null || raw?.templateId === undefined
        ? null
        : asString(raw?.templateId),
    createdByUid:
      raw?.createdByUid === null || raw?.createdByUid === undefined
        ? null
        : asString(raw?.createdByUid),
    createdByEmail:
      raw?.createdByEmail === null || raw?.createdByEmail === undefined
        ? null
        : asString(raw?.createdByEmail),
    createdAt: raw?.createdAt,
    updatedAt: raw?.updatedAt,
  };
}

export function normalizeTemplateDoc(raw: any, id: string): DailyActivityTemplate {
  const activitiesRaw: any[] = Array.isArray(raw?.activities) ? raw.activities : [];

  return {
    id,
    name: asString(raw?.name) || "Template",
    description: asString(raw?.description),
    activities: activitiesRaw.map((item: any, index: number) =>
      normalizeActivityItem(item, index)
    ),
    createdAt: raw?.createdAt,
    updatedAt: raw?.updatedAt,
    lastUsedAt: raw?.lastUsedAt,
  };
}

export function sortReportsByUpdatedAtDesc(reports: DailyActivityReport[]) {
  return [...reports].sort((a, b) => {
    const left = asTimestampMillis(a.updatedAt) || asTimestampMillis(a.createdAt);
    const right = asTimestampMillis(b.updatedAt) || asTimestampMillis(b.createdAt);
    return right - left;
  });
}

export function sortTemplatesByUpdatedAtDesc(templates: DailyActivityTemplate[]) {
  return [...templates].sort((a, b) => {
    const left = asTimestampMillis(a.updatedAt) || asTimestampMillis(a.createdAt);
    const right = asTimestampMillis(b.updatedAt) || asTimestampMillis(b.createdAt);
    return right - left;
  });
}

export function getTenantDocRef(db: Firestore) {
  const { judetId, structuraId } = getTenantContext();
  return doc(db, `Judete/${judetId}/Structuri/${structuraId}`);
}

export function getDailyActivityReportsCollection(db: Firestore) {
  return collection(getTenantDocRef(db), "ActivitateZilnicaRapoarte");
}

export function getDailyActivityTemplatesCollection(db: Firestore) {
  return collection(getTenantDocRef(db), "ActivitateZilnicaTemplateuri");
}
