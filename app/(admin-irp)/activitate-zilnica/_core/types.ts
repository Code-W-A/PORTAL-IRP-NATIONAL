import type { Timestamp } from "firebase/firestore";

export type DailyActivityItem = {
  id: string;
  intervalOrar: string;
  activitate: string;
  executant: string;
  observatii: string;
};

export type IntocmitSignature = {
  nume: string;
};

export type AprobatSignature = {
  functia: string;
  grad: string;
  nume: string;
};

export type DailyActivityReportDoc = {
  reportDate: string;
  reportTimestamp: Timestamp;
  title: string;
  registrationNumber?: string;
  activities: DailyActivityItem[];
  intocmit: IntocmitSignature;
  aprobat: AprobatSignature;
  templateId?: string | null;
  createdByUid?: string | null;
  createdByEmail?: string | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type DailyActivityReport = DailyActivityReportDoc & {
  id: string;
};

export type DailyActivityReportDraft = Omit<
  DailyActivityReport,
  "id" | "reportTimestamp" | "createdAt" | "updatedAt"
>;

export type DailyActivityTemplateDoc = {
  name: string;
  description?: string;
  activities: DailyActivityItem[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  lastUsedAt?: Timestamp;
};

export type DailyActivityTemplate = DailyActivityTemplateDoc & {
  id: string;
};

export type DailyActivityTemplateDraft = Omit<
  DailyActivityTemplate,
  "id" | "createdAt" | "updatedAt" | "lastUsedAt"
>;

export type DailyActivityPrintSettings = {
  headerLines: string[];
  footerLines: string[];
  logoUrlPublic: string;
  unitLabel: string;
  phone: string;
  email: string;
};
