export type ReportColumnWidth = "s" | "m" | "l";

export type ReportColumnKind = "text" | "textarea" | "date_flexible";

export type PeriodPreset = "next_week" | "previous_week" | "custom" | "previous_month" | "previous_year";

export type ReportTypeColumn = {
  id: string;
  label: string;
  kind: ReportColumnKind;
  width: ReportColumnWidth;
  required: boolean;
  order: number;
};

export type ReportTypeDoc = {
  id: string;
  name: string;
  description: string;
  columns: ReportTypeColumn[];
  archived: boolean;
  createdAt?: any;
  updatedAt?: any;
};

export type ReportRowDoc = {
  id: string;
  cells: Record<string, string>;
};

export type ReportInstanceDoc = {
  id: string;
  typeId: string;
  typeNameSnapshot: string;
  typeDescriptionSnapshot: string;
  columnsSnapshot: ReportTypeColumn[];
  title: string;
  registrationNumber: string;
  periodPreset: PeriodPreset;
  periodStart: string;
  periodEnd: string;
  rows: ReportRowDoc[];
  createdAt?: any;
  updatedAt?: any;
};

export type ReportExportPayload = {
  report: Omit<ReportInstanceDoc, "id" | "createdAt" | "updatedAt">;
  includeSignatures: boolean;
};

export type ReportSettingsStatus = {
  hasIntocmit: boolean;
  hasAprobat: boolean;
  intocmit?: { nume?: string } | null;
  aprobat?: { nume?: string; functia?: string; grad?: string } | null;
};

export type ReportTypePeriodPrefs = {
  lastPeriodStart?: string;
  lastPeriodEnd?: string;
  lastRegistrationNumber?: string;
};

export type RaportariSettingsDoc = {
  byTypeId: Record<string, ReportTypePeriodPrefs>;
};

export type RaportariSettingsResponse = ReportSettingsStatus & {
  raportariPrefs?: RaportariSettingsDoc;
};
