export type InterventionType = {
  id: string;
  name: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  createdBy: string;
};

export type InterventionTypeDraft = Pick<InterventionType, "name" | "enabled" | "sortOrder">;

export type InterventionRecord = {
  id: string;
  typeId: string;
  typeName: string;
  occurredAt: string;
  communicated: boolean;
  bicpComunicatId?: string;
  bicpComunicatLabel?: string;
  createdAt: string;
  createdBy: string;
};

export type InterventionRecordDraft = {
  typeId: string;
  occurredAt: string;
  communicated: boolean;
  bicpComunicatId?: string;
  bicpComunicatLabel?: string;
};

export type InterventionStatsFilters = {
  preset?: "last7" | "last30" | "last365" | "currentYear" | "all";
  startDate?: string;
  endDate?: string;
  typeId?: string;
};

export type InterventionStats = {
  total: number;
  communicated: number;
  byType: Array<{ typeId: string; typeName: string; total: number; communicated: number }>;
  monthlyTotals: Array<{ month: string; total: number; communicated: number }>;
  yearlyTotals: Array<{ year: string; total: number; communicated: number }>;
};
