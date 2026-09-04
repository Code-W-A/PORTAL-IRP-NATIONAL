export type ReportingExport = {
  meta: {
    generatedAt: string;
    judetId: string;
    structuraId: string;
    periodStart: string;
    periodEnd: string;
    readOnly: true;
  };
  indicators: {
    activitateIrp: {
      comunicate: number;
      buletine: number;
      totalComunicateBuletine: number;
      conferinte: number;
      briefinguri: null;
      totalConferinteBriefinguri: null;
      solicitari544Scrise: number;
      solicitari544Verbale: number;
      totalSolicitari544: number;
      activitatiPublice: null;
    };
    platformaMai: {
      comunicate: null;
      buletine: null;
      stiri: null;
      conferinte: null;
      declaratii: null;
      invitatiiPresa: null;
      evaluariConferinte: null;
      alteMateriale: null;
    };
    siteOficial: {
      comunicateBuletine: null;
      stiriLocale: null;
      conferinte: null;
    };
    aplicatiaDsu: {
      materialePublicate: null;
    };
  };
  dataQuality: {
    complete: boolean;
    missingFields: string[];
    notes: string[];
  };
};

export type ReportingExportInput = {
  judetId: string;
  structuraId: string;
  periodStart: string;
  periodEnd: string;
  comunicate: Array<{ id: string } & Record<string, unknown>>;
  foia: Array<{ id: string } & Record<string, unknown>>;
};

const MISSING_FIELDS = [
  "activitateIrp.briefinguri",
  "activitateIrp.totalConferinteBriefinguri",
  "activitateIrp.activitatiPublice",
  "platformaMai.comunicate",
  "platformaMai.buletine",
  "platformaMai.stiri",
  "platformaMai.conferinte",
  "platformaMai.declaratii",
  "platformaMai.invitatiiPresa",
  "platformaMai.evaluariConferinte",
  "platformaMai.alteMateriale",
  "siteOficial.comunicateBuletine",
  "siteOficial.stiriLocale",
  "siteOficial.conferinte",
  "aplicatiaDsu.materialePublicate",
] as const;

const QUALITY_NOTES = [
  "0 la comunicate, buletine, conferințe și 544 înseamnă „numărat pe interval, zero înregistrări”, nu lipsă de schemă.",
  "briefinguri / totalConferinteBriefinguri: nu există tip BICP „Briefing”.",
  "activitatiPublice: activityEvents nu are estePublica.",
  "platformaMai, siteOficial, aplicatiaDsu: nu există canale de publicare pe Comunicate.",
];

export function asIsoDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const slash = value.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
    if (slash) return `${slash[3]}-${slash[2]}-${slash[1]}`;
    const dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  if (typeof value === "object" && value && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
    } catch {
      return null;
    }
  }
  return null;
}

export function isIsoInRange(iso: string | null, start: string, end: string) {
  if (!iso) return false;
  return iso >= start && iso <= end;
}

export function normalizeComunicatType(data: Record<string, unknown>): string {
  const raw = String(data.tipDocument || data.nume || data.tip || "");
  if (!raw) return "Comunicat de Presă";
  if (raw === "Buletin Informativ" || raw === "Comunicat de Presă" || raw === "Conferință de presă") return raw;
  const upper = raw.toUpperCase();
  if (upper === "BI") return "Buletin Informativ";
  if (upper === "PC" || upper === "CI") return "Comunicat de Presă";
  return raw;
}

function comunicatDate(data: Record<string, unknown>) {
  return asIsoDate(data.dataTimestamp) || asIsoDate(data.data);
}

export function buildReportingExport(input: ReportingExportInput): ReportingExport {
  const { periodStart, periodEnd } = input;

  let comunicateCount = 0;
  let buletineCount = 0;
  let conferinteCount = 0;

  for (const item of input.comunicate) {
    const date = comunicatDate(item);
    if (!isIsoInRange(date, periodStart, periodEnd)) continue;
    const tip = normalizeComunicatType(item);
    if (tip === "Buletin Informativ") buletineCount += 1;
    else if (tip === "Comunicat de Presă") comunicateCount += 1;
    if (tip === "Conferință de presă") conferinteCount += 1;
  }

  let written544 = 0;
  let verbal544 = 0;
  for (const item of input.foia) {
    const date = asIsoDate(item.requestDate);
    if (!isIsoInRange(date, periodStart, periodEnd)) continue;
    if (item.requestType === "verbal") verbal544 += 1;
    else written544 += 1;
  }

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      judetId: input.judetId,
      structuraId: input.structuraId,
      periodStart,
      periodEnd,
      readOnly: true,
    },
    indicators: {
      activitateIrp: {
        comunicate: comunicateCount,
        buletine: buletineCount,
        totalComunicateBuletine: comunicateCount + buletineCount,
        conferinte: conferinteCount,
        briefinguri: null,
        totalConferinteBriefinguri: null,
        solicitari544Scrise: written544,
        solicitari544Verbale: verbal544,
        totalSolicitari544: written544 + verbal544,
        activitatiPublice: null,
      },
      platformaMai: {
        comunicate: null,
        buletine: null,
        stiri: null,
        conferinte: null,
        declaratii: null,
        invitatiiPresa: null,
        evaluariConferinte: null,
        alteMateriale: null,
      },
      siteOficial: {
        comunicateBuletine: null,
        stiriLocale: null,
        conferinte: null,
      },
      aplicatiaDsu: {
        materialePublicate: null,
      },
    },
    dataQuality: {
      complete: false,
      missingFields: [...MISSING_FIELDS],
      notes: [...QUALITY_NOTES],
    },
  };
}
