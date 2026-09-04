export type SentimentCounts = {
  favorabile: number;
  neutre: number;
  defavorabile: number;
  total: number;
};

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
    media: {
      presa: SentimentCounts;
      tv: SentimentCounts;
      radio: SentimentCounts;
    };
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
  records: {
    activitati: ReportingActivityRecord[];
    comunicate: ReportingComunicatRecord[];
    intentiiMediatizare: ReportingIntentieRecord[];
    atacuriMediatice: null;
    calendar: ReportingCalendarRecord[];
    conferintePresa: ReportingConferintaRecord[];
  };
  dataQuality: {
    complete: boolean;
    missingFields: string[];
    notes: string[];
  };
};

export type ReportingActivityRecord = {
  id: string;
  data: string | null;
  titlu: string | null;
  descriere: string | null;
  tip: string | null;
  status: null;
  estePublica: null;
  mediatizata: null;
  linkFotoVideo: null;
  locatie: string | null;
};

export type ReportingComunicatRecord = {
  id: string;
  data: string | null;
  titlu: string | null;
  tip: string | null;
  status: null;
  canale: null;
};

export type ReportingIntentieRecord = {
  reportId: string;
  rowId: string;
  data: string | null;
  activitate: string | null;
  modalitate: string | null;
  persoane: string | null;
  observatii: string | null;
};

export type ReportingCalendarRecord = {
  id: string;
  data: string | null;
  titlu: string | null;
  descriere: string | null;
  categorie: string | null;
  locatie: string | null;
};

export type ReportingConferintaRecord = {
  id: string;
  source: "comunicate" | "mape";
  data: string | null;
  titlu: string | null;
};

export type ReportingExportInput = {
  judetId: string;
  structuraId: string;
  periodStart: string;
  periodEnd: string;
  comunicate: Array<{ id: string } & Record<string, unknown>>;
  monitorizare: Array<{ id: string } & Record<string, unknown>>;
  foia: Array<{ id: string } & Record<string, unknown>>;
  calendar: Array<{
    id: string;
    title: string;
    description?: string;
    startDateTime: string;
    location?: string;
    category?: string;
  }>;
  raportari: Array<{ id: string } & Record<string, unknown>>;
  mape: Array<{ id: string } & Record<string, unknown>>;
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
  "records.comunicate.status",
  "records.comunicate.canale",
  "records.activitati.status",
  "records.activitati.estePublica",
  "records.activitati.mediatizata",
  "records.activitati.linkFotoVideo",
  "records.atacuriMediatice",
] as const;

const QUALITY_NOTES = [
  "0 la media, comunicate, buletine, conferințe și 544 înseamnă „numărat pe interval, zero înregistrări”, nu lipsă de schemă.",
  "briefinguri: nu există tip BICP „Briefing” — ar trebui adăugat nume/tip sau un flag.",
  "activitatiPublice: activityEvents nu are estePublica.",
  "platformaMai, siteOficial, aplicatiaDsu: nu există canale de publicare pe Comunicate (publishedOnMai / publishedOnSite / publishedOnDsu).",
  "comunicate.status și canale lipsesc din schema Comunicate.",
  "activitati.mediatizata și linkFotoVideo lipsesc de pe calendar.",
  "atacuriMediatice: nu există colecție dedicată; sentiment defavorabil din monitorizare nu este mapat ca atac.",
];

export function emptySentimentCounts(): SentimentCounts {
  return { favorabile: 0, neutre: 0, defavorabile: 0, total: 0 };
}

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

export function periodsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && aEnd >= bStart;
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

function incrementSentiment(counts: SentimentCounts, sentiment: string) {
  if (sentiment === "favorabil") counts.favorabile += 1;
  else if (sentiment === "defavorabil") counts.defavorabile += 1;
  else counts.neutre += 1;
  counts.total += 1;
}

function textOrNull(value: unknown) {
  const text = String(value || "").trim();
  return text || null;
}

export function buildReportingExport(input: ReportingExportInput): ReportingExport {
  const { periodStart, periodEnd } = input;

  const presa = emptySentimentCounts();
  const tv = emptySentimentCounts();
  const radio = emptySentimentCounts();

  for (const item of input.monitorizare) {
    const date = asIsoDate(item.dataTimestamp) || asIsoDate(item.data);
    if (!isIsoInRange(date, periodStart, periodEnd)) continue;
    const canal = String(item.canal || "presa");
    const sentiment = String(item.sentiment || "neutru");
    if (canal === "tv") incrementSentiment(tv, sentiment);
    else if (canal === "radio") incrementSentiment(radio, sentiment);
    else incrementSentiment(presa, sentiment);
  }

  let comunicateCount = 0;
  let buletineCount = 0;
  let conferinteCount = 0;
  const comunicateRecords: ReportingComunicatRecord[] = [];
  const conferinteFromComunicate: ReportingConferintaRecord[] = [];

  for (const item of input.comunicate) {
    const date = comunicatDate(item);
    if (!isIsoInRange(date, periodStart, periodEnd)) continue;
    const tip = normalizeComunicatType(item);
    if (tip === "Buletin Informativ") buletineCount += 1;
    else if (tip === "Comunicat de Presă") comunicateCount += 1;
    if (tip === "Conferință de presă") {
      conferinteCount += 1;
      conferinteFromComunicate.push({
        id: item.id,
        source: "comunicate",
        data: date,
        titlu: textOrNull(item.titlu) || textOrNull(item.numeAfisare),
      });
    }
    comunicateRecords.push({
      id: item.id,
      data: date,
      titlu: textOrNull(item.titlu) || textOrNull(item.numeAfisare),
      tip,
      status: null,
      canale: null,
    });
  }

  let written544 = 0;
  let verbal544 = 0;
  for (const item of input.foia) {
    const date = asIsoDate(item.requestDate);
    if (!isIsoInRange(date, periodStart, periodEnd)) continue;
    if (item.requestType === "verbal") verbal544 += 1;
    else written544 += 1;
  }

  const activitati: ReportingActivityRecord[] = input.calendar.map((event) => ({
    id: event.id,
    data: asIsoDate(event.startDateTime),
    titlu: textOrNull(event.title),
    descriere: textOrNull(event.description),
    tip: textOrNull(event.category),
    status: null,
    estePublica: null,
    mediatizata: null,
    linkFotoVideo: null,
    locatie: textOrNull(event.location),
  }));

  const calendar: ReportingCalendarRecord[] = input.calendar.map((event) => ({
    id: event.id,
    data: asIsoDate(event.startDateTime),
    titlu: textOrNull(event.title),
    descriere: textOrNull(event.description),
    categorie: textOrNull(event.category),
    locatie: textOrNull(event.location),
  }));

  const intentiiMediatizare: ReportingIntentieRecord[] = [];
  for (const report of input.raportari) {
    if (String(report.typeId || "") !== "intentii-mediatizare") continue;
    const start = String(report.periodStart || "");
    const end = String(report.periodEnd || "");
    if (start && end && !periodsOverlap(start, end, periodStart, periodEnd)) continue;
    const rows = Array.isArray(report.rows) ? report.rows : [];
    for (const row of rows) {
      const cells = row && typeof row === "object" && "cells" in row ? (row as { cells?: Record<string, unknown> }).cells || {} : {};
      intentiiMediatizare.push({
        reportId: report.id,
        rowId: String((row as { id?: string })?.id || ""),
        data: textOrNull(cells.data),
        activitate: textOrNull(cells.activitate),
        modalitate: textOrNull(cells.modalitate),
        persoane: textOrNull(cells.persoane),
        observatii: textOrNull(cells.observatii),
      });
    }
  }

  const conferintePresa: ReportingConferintaRecord[] = [...conferinteFromComunicate];
  for (const mapa of input.mape) {
    const conference = mapa.conference && typeof mapa.conference === "object" ? (mapa.conference as Record<string, unknown>) : null;
    const date = asIsoDate(conference?.date);
    if (!isIsoInRange(date, periodStart, periodEnd)) continue;
    const material = mapa.conferenceMaterial && typeof mapa.conferenceMaterial === "object" ? (mapa.conferenceMaterial as Record<string, unknown>) : null;
    conferintePresa.push({
      id: mapa.id,
      source: "mape",
      data: date,
      titlu: textOrNull(material?.title) || textOrNull(mapa.titlu),
    });
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
      media: { presa, tv, radio },
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
    records: {
      activitati,
      comunicate: comunicateRecords,
      intentiiMediatizare,
      atacuriMediatice: null,
      calendar,
      conferintePresa,
    },
    dataQuality: {
      complete: false,
      missingFields: [...MISSING_FIELDS],
      notes: [...QUALITY_NOTES],
    },
  };
}
