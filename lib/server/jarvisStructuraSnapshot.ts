import { firestoreGetDocAsJson, firestoreListCollection } from "@/lib/server/firestoreRest";
import { JARVIS_ISU_DB_TENANT } from "@/lib/server/jarvisMakeAuth";

export const STRUCTURA_SOURCES = [
  "comunicate",
  "monitorizare",
  "calendar",
  "foia",
  "acreditari",
  "jurnalisti",
  "mape",
  "raportari",
  "raportariTipuri",
  "activitate",
  "interventii",
  "settings",
] as const;

export type StructuraSource = (typeof STRUCTURA_SOURCES)[number];

type RawDoc = { id: string; data: Record<string, any> };

type CollectionReader = {
  list(collectionId: string, maxDocs: number): Promise<RawDoc[]>;
  get(docPath: string): Promise<Record<string, any> | null>;
};

const DROP_FIELD = /html|pdf|word|email|telefon|phone|parola|secret|continut|comunicat|cnp|serieci|numarci/i;

function asIsoDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const slash = value.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);
    if (slash) return `${slash[3]}-${slash[2]}-${slash[1]}`;
    const dt = new Date(value);
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  if (typeof value === "object" && value && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
    } catch {
      return null;
    }
  }
  return null;
}

function pick(data: Record<string, any>, keys: string[]) {
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (data[key] === undefined || data[key] === null || data[key] === "") continue;
    if (DROP_FIELD.test(key)) continue;
    const value = data[key];
    if (typeof value === "string" && value.length > 800) out[key] = `${value.slice(0, 800)}…`;
    else out[key] = value;
  }
  return out;
}

function compactUnknown(data: Record<string, any>) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (DROP_FIELD.test(key)) continue;
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "string") out[key] = value.length > 400 ? `${value.slice(0, 400)}…` : value;
    else if (typeof value === "number" || typeof value === "boolean") out[key] = value;
    else if (typeof value === "string" || value instanceof Date) {
      const iso = asIsoDate(value);
      if (iso) out[key] = iso;
    }
  }
  return out;
}

function inRange(iso: string | null, from?: string, to?: string) {
  if (!from && !to) return true;
  if (!iso) return true;
  if (from && iso < from) return false;
  if (to && iso > to) return false;
  return true;
}

function compactComunicat(doc: RawDoc) {
  const data = doc.data;
  return {
    id: doc.id,
    numar: data.numarComunicat ?? data.numar ?? null,
    tip: data.tipDocument || data.nume || data.tip || null,
    titlu: data.titlu || data.numeAfisare || null,
    categorie: data.categorie || null,
    data: asIsoDate(data.dataTimestamp) || asIsoDate(data.data),
  };
}

function compactMedia(doc: RawDoc) {
  const data = doc.data;
  return {
    id: doc.id,
    titlu: data.titlu || null,
    canal: data.canal || null,
    sentiment: data.sentiment || null,
    data: asIsoDate(data.dataTimestamp) || asIsoDate(data.data),
    link: data.link || null,
  };
}

function compactEvent(doc: RawDoc) {
  const data = doc.data;
  return {
    id: doc.id,
    title: data.title || null,
    description: typeof data.description === "string" ? data.description.slice(0, 400) : null,
    start: asIsoDate(data.startDateTime) || data.startDateTime || null,
    end: asIsoDate(data.endDateTime) || data.endDateTime || null,
    location: data.location || null,
    category: data.category || null,
    source: data.source || null,
  };
}

function compactFoia(doc: RawDoc) {
  const data = doc.data;
  return {
    id: doc.id,
    numar: data.requestNumber || null,
    data: asIsoDate(data.requestDate),
    solicitant: data.requesterName || null,
    tip: data.requestType || null,
    informatie: data.requestedInformation || null,
    domeniu: data.interestDomain || null,
    stare: data.responseNature || null,
    raspunsLa: asIsoDate(data.responseDate),
  };
}

function compactAcreditare(doc: RawDoc) {
  const data = doc.data;
  return {
    id: doc.id,
    numar: data.numar || data.numarAcreditare || null,
    data: asIsoDate(data.data) || data.data || null,
    nume: [data.prenume, data.nume].filter(Boolean).join(" ") || data.numeAfisare || null,
    institutie: data.institutie || data.redactie || data.publicatie || null,
    status: data.status || data.stare || null,
  };
}

function compactJurnalist(doc: RawDoc) {
  const data = doc.data;
  return {
    id: doc.id,
    nume: [data.prenume, data.nume].filter(Boolean).join(" ") || data.numeAfisare || null,
    institutie: data.institutie || data.redactie || data.publicatie || null,
    functie: data.functie || null,
  };
}

function compactMapa(doc: RawDoc) {
  const data = doc.data;
  return {
    id: doc.id,
    ...pick(data, ["titlu", "title", "nume", "luna", "an", "year", "month", "periodStart", "periodEnd", "status"]),
    data: asIsoDate(data.createdAt) || asIsoDate(data.updatedAt),
  };
}

function compactRaport(doc: RawDoc) {
  const data = doc.data;
  const rows = Array.isArray(data.rows)
    ? data.rows.map((row: any) => ({
        id: String(row?.id || ""),
        cells: row?.cells && typeof row.cells === "object" ? row.cells : {},
      }))
    : [];
  return {
    id: doc.id,
    typeId: data.typeId || null,
    title: data.title || null,
    registrationNumber: data.registrationNumber || null,
    periodStart: data.periodStart || null,
    periodEnd: data.periodEnd || null,
    rows,
  };
}

function compactSettings(data: Record<string, any> | null) {
  if (!data) return null;
  const semnatari = Array.isArray(data.semnatari)
    ? data.semnatari.map((item: any) => pick(item || {}, ["functia", "grad", "nume"]))
    : [];
  const purtatori = Array.isArray(data.purtatori)
    ? data.purtatori.map((item: any) => pick(item || {}, ["nume"]))
    : [];
  return {
    unitLabel: data.unitLabel || data.structureDisplay || null,
    city: data.city || null,
    email: data.email || null,
    semnatari,
    purtatori,
  };
}

function sourceDate(source: StructuraSource, item: Record<string, any>): string | null {
  if (source === "calendar") return asIsoDate(item.start);
  return asIsoDate(item.data) || asIsoDate(item.periodStart) || asIsoDate(item.requestDate);
}

function createRestReader(idToken: string, parent: string): CollectionReader {
  return {
    async list(collectionId, maxDocs) {
      return firestoreListCollection(`${parent}/${collectionId}`, idToken, { maxDocs });
    },
    async get(docPath) {
      return firestoreGetDocAsJson(`${parent}/${docPath}`, idToken);
    },
  };
}

async function loadSource(reader: CollectionReader, source: StructuraSource, from?: string, to?: string) {
  const applyRange = (items: Array<Record<string, any>>) =>
    items.filter((item) => inRange(sourceDate(source, item), from, to));

  switch (source) {
    case "comunicate":
      return applyRange((await reader.list("Comunicate", 1500)).map(compactComunicat));
    case "monitorizare":
      return applyRange((await reader.list("MonitorizarePresa", 800)).map(compactMedia));
    case "calendar":
      return applyRange((await reader.list("activityEvents", 800)).map(compactEvent));
    case "foia":
      return applyRange((await reader.list("publicInformationRequests", 400)).map(compactFoia));
    case "acreditari":
      return applyRange((await reader.list("Acreditari", 400)).map(compactAcreditare));
    case "jurnalisti":
      return (await reader.list("Jurnalisti", 400)).map(compactJurnalist);
    case "mape":
      return (await reader.list("MapePresa", 200)).map(compactMapa);
    case "raportari":
      return applyRange((await reader.list("Raportari", 200)).map(compactRaport));
    case "raportariTipuri":
      return (await reader.list("RaportariTipuri", 40)).map((doc) => ({
        id: doc.id,
        name: doc.data.name || null,
        description: doc.data.description || null,
        columns: Array.isArray(doc.data.columns) ? doc.data.columns : [],
      }));
    case "activitate":
      return (await reader.list("ActivitateZilnicaRapoarte", 80)).map((doc) => ({
        id: doc.id,
        ...compactUnknown(doc.data),
      }));
    case "interventii":
      return (await reader.list("InterventiiInregistrari", 200)).map((doc) => ({
        id: doc.id,
        ...compactUnknown(doc.data),
      }));
    case "settings": {
      const [general, raportari] = await Promise.all([
        reader.get("Settings/general"),
        reader.get("Settings/raportari"),
      ]);
      return { general: compactSettings(general), raportari: raportari || null };
    }
  }
}

export async function buildJarvisStructuraSnapshot(idToken: string) {
  const tenant = JARVIS_ISU_DB_TENANT;
  const parent = `Judete/${tenant.judetId}/Structuri/${tenant.structuraId}`;
  const reader = createRestReader(idToken, parent);
  const sources = [...STRUCTURA_SOURCES];
  const data: Record<string, unknown> = {};
  const counts: Record<string, number> = {};
  const errors: Record<string, string> = {};

  await Promise.all(
    sources.map(async (source) => {
      try {
        const value = await loadSource(reader, source);
        data[source] = value;
        counts[source] = Array.isArray(value) ? value.length : value ? 1 : 0;
      } catch (err) {
        errors[source] = err instanceof Error ? err.message : "error";
        data[source] = source === "settings" ? null : [];
        counts[source] = 0;
      }
    })
  );

  return {
    readOnly: true,
    tenant,
    path: parent,
    sources,
    counts,
    errors: Object.keys(errors).length ? errors : undefined,
    data,
  };
}
