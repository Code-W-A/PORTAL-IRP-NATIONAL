export const MEDIA_DOCUMENT_TYPES = [
  "Buletin Informativ",
  "Comunicat de Presă",
  "Știre",
  "Declarație de presă",
  "Conferință de presă",
  "Invitație",
  "Interviu",
  "Anunț",
  "Eveniment de presă",
  "Drept la replică",
  "Informare de presă",
  "Evaluare conferință de presă",
  "Punct de vedere",
] as const;

const ALTE_TYPES = new Set<string>([
  "Interviu",
  "Anunț",
  "Eveniment de presă",
  "Drept la replică",
  "Informare de presă",
  "Punct de vedere",
]);

export type PublishedMediaCounts = {
  maiComunicate: number;
  maiBuletine: number;
  maiStiri: number;
  maiConferinte: number;
  maiDeclaratii: number;
  maiInvitatii: number;
  maiEvaluari: number;
  maiAlte: number;
  siteComunicateBuletine: number;
  siteStiri: number;
  siteConferinte: number;
  dsu: number;
};

export function emptyPublishedMedia(): PublishedMediaCounts {
  return {
    maiComunicate: 0,
    maiBuletine: 0,
    maiStiri: 0,
    maiConferinte: 0,
    maiDeclaratii: 0,
    maiInvitatii: 0,
    maiEvaluari: 0,
    maiAlte: 0,
    siteComunicateBuletine: 0,
    siteStiri: 0,
    siteConferinte: 0,
    dsu: 0,
  };
}

export function normalizeMediaType(data: Record<string, unknown> | null | undefined): string {
  const rawDocType = String(data?.tipDocument || data?.nume || data?.tip || "");
  if (rawDocType) {
    if ((MEDIA_DOCUMENT_TYPES as readonly string[]).includes(rawDocType)) return rawDocType;
    const upper = rawDocType.toUpperCase();
    if (upper === "BI") return "Buletin Informativ";
    if (upper === "PC" || upper === "CI") return "Comunicat de Presă";
  }
  return "Comunicat de Presă";
}

export function addPublishedMedia(target: PublishedMediaCounts, data: Record<string, unknown>) {
  const type = normalizeMediaType(data);

  if (data.incarcatHubMai === true) {
    if (type === "Comunicat de Presă") target.maiComunicate += 1;
    else if (type === "Buletin Informativ") target.maiBuletine += 1;
    else if (type === "Știre") target.maiStiri += 1;
    else if (type === "Conferință de presă") target.maiConferinte += 1;
    else if (type === "Declarație de presă") target.maiDeclaratii += 1;
    else if (type === "Invitație") target.maiInvitatii += 1;
    else if (type === "Evaluare conferință de presă") target.maiEvaluari += 1;
    else if (ALTE_TYPES.has(type)) target.maiAlte += 1;
  }

  if (data.incarcatSite === true) {
    if (type === "Comunicat de Presă" || type === "Buletin Informativ") target.siteComunicateBuletine += 1;
    else if (type === "Știre") target.siteStiri += 1;
    else if (type === "Conferință de presă") target.siteConferinte += 1;
  }

  if (data.incarcatDSU === true) target.dsu += 1;
}
