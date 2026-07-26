import type { Timestamp } from "firebase/firestore";

export type StructuraKey = `${string}_${string}`; // `${judetId}_${structuraId}`

export type CerereStatus = "pending" | "approved" | "rejected";

export type CerereAttachmentFile = {
  path: string;
  name?: string;
  contentType?: string;
  size?: number;
};

export type CerereAcreditare = {
  structuri: { judetId: string; structuraId: string; display?: string }[];
  structuraKeys: StructuraKey[];
  statusByStructura: Record<
    StructuraKey,
    {
      status: CerereStatus;
      decidedAt?: Timestamp;
      decidedByUid?: string;
      decidedByEmail?: string | null;
      acreditareId?: string;
      acreditareNumar?: string;
      acreditareData?: string;
    }
  >;

  createdAt?: Timestamp;
  submittedAt?: Timestamp;

  media: {
    tip: Record<string, boolean>;
    tipAltceva?: string;
    denumire: string;
    cui?: string;
    adresa?: string;
    email?: string;
    telefon?: { fix?: string; fax?: string; mobil?: string };
    website?: string;
  };

  jurnalist: {
    numePrenume: string;
    /** Sex used for "doamna/domnul" in accreditation PDF. */
    sex?: "F" | "M";
    dataNasterii?: string | null;
    locNastere?: string;
    cetatenie?: string;
    documentIdentitate?: { tip?: string; serieNumar?: string };
    adresa?: string;
    legitimatie?: { numar?: string; dataExpirare?: string | null };
    functie?: Record<string, any>;
    email?: string;
    telefon?: { fix?: string; fax?: string; mobil?: string };
  };

  consimtamant?: {
    norme?: boolean;
    gdpr?: boolean;
    gdprVersion?: string;
    gdprAcceptedAt?: Timestamp;
  };

  attachments?: null | {
    /**
     * New format: array (max 2) of JPG/PNG images.
     * Backward compat: some older records might still have a single object.
     */
    legitimatie?: CerereAttachmentFile[] | CerereAttachmentFile;
    semnatura?: { path: string; contentType?: string } | null;
  };

  attachmentsUploadedAt?: Timestamp;

  /** Optional: used by admin flows to store the accreditation certificate number/date to be used at approve time. */
  acreditare?: {
    numar?: string;
    data?: string; // DD/MM/YYYY
  };

  /** Optional provenance (simple form, issued acreditareId for single-structure, etc.). */
  source?: {
    simple?: boolean;
    acreditareId?: string;
    kind?: string;
    cerereId?: string;
    structuraKey?: string;
  } | null;
};

export function buildStructuraKey(judetId: string, structuraId: string): StructuraKey {
  return `${String(judetId).toUpperCase()}_${String(structuraId).toUpperCase()}` as StructuraKey;
}

export function normalizeLegitimatieAttachments(
  attachments: CerereAcreditare["attachments"] | undefined | null
): CerereAttachmentFile[] {
  const legit = attachments?.legitimatie as any;
  if (!legit) return [];
  if (Array.isArray(legit)) return legit.filter(Boolean);
  if (typeof legit === "object" && typeof legit.path === "string") return [legit as CerereAttachmentFile];
  return [];
}

export type JurnalistIdentityInput = {
  nume?: string;
  redactie?: string;
  email?: string;
  telefon?: string;
  legit?: string;
};

/** Normalizes a single field into a safe Firestore document id segment. */
export function normalizeJurnalistIdPart(value: string): string {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

/**
 * Stable journalist doc id used across approve, simple form, import and registry edits.
 * Priority: legitimatie nr → email → telefon (canonical intl) → nume+redactie → fallback.
 */
export function buildJurnalistDocId(input: JurnalistIdentityInput, fallbackSuffix?: string): string {
  const legit = normalizeJurnalistIdPart(String(input.legit || ""));
  if (legit) return legit;

  const email = normalizeJurnalistIdPart(String(input.email || "").trim().toLowerCase());
  if (email) return email;

  // Canonical phone id (RO 0722… / +40… → 40722…) so formats don't create duplicate docs.
  const telefonCanon = normalizePhoneForWhatsApp(input.telefon);
  if (telefonCanon) return normalizeJurnalistIdPart(telefonCanon);

  const composite = normalizeJurnalistIdPart(`${input.nume || ""} ${input.redactie || ""}`);
  if (composite) return composite;

  const suffix = String(fallbackSuffix || Date.now());
  return normalizeJurnalistIdPart(`J_${suffix}`) || `J_${suffix}`.slice(0, 80);
}

/**
 * Possible Firestore doc ids for the same phone across legacy formats
 * (0722…, +40722…, 40722…, digits-only, etc.). First match in registry wins (BC).
 */
export function jurnalistPhoneDocIdCandidates(telefon?: string | null): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw: string) => {
    const id = normalizeJurnalistIdPart(raw);
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  };

  const wa = normalizePhoneForWhatsApp(telefon);
  if (wa) add(wa);

  let raw = String(telefon || "")
    .trim()
    .replace(/[^\d+]/g, "")
    .replace(/(?!^)\+/g, "");
  if (raw) {
    add(raw);
    if (raw.startsWith("+")) add(raw.slice(1));
    if (raw.startsWith("00")) add(raw.slice(2));
  }

  const digits = String(telefon || "").replace(/\D/g, "");
  if (digits) add(digits);

  if (wa && /^40\d{9}$/.test(wa)) {
    add(`0${wa.slice(2)}`);
    add(wa.slice(2));
  }
  if (wa) add(`+${wa}`);

  return out;
}

function findExistingPhoneBasedDocId(
  input: JurnalistIdentityInput,
  getExisting: (id: string) => Record<string, any> | null | undefined
): string | null {
  const hasLegit = Boolean(normalizeJurnalistIdPart(String(input.legit || "")));
  const hasEmail = Boolean(normalizeJurnalistIdPart(String(input.email || "").trim().toLowerCase()));
  if (hasLegit || hasEmail) return null;
  if (!String(input.telefon || "").trim()) return null;

  for (const id of jurnalistPhoneDocIdCandidates(input.telefon)) {
    const existing = getExisting(id);
    if (existing && isCompatibleJurnalistRecord(existing, input)) return id;
  }
  return null;
}

export function jurnalistIdentityFromCerere(
  cerere: Pick<CerereAcreditare, "jurnalist" | "media">
): JurnalistIdentityInput {
  const j = cerere.jurnalist || ({} as CerereAcreditare["jurnalist"]);
  const media = cerere.media || ({} as CerereAcreditare["media"]);
  return {
    legit: String(j.legitimatie?.numar || ""),
    email: String(j.email || ""),
    telefon: String(j.telefon?.mobil || j.telefon?.fix || ""),
    nume: String(j.numePrenume || ""),
    redactie: String(media.denumire || ""),
  };
}

export function buildJurnalistDocIdFromCerere(cerere: Pick<CerereAcreditare, "jurnalist" | "media">, cerereId: string): string {
  return buildJurnalistDocId(jurnalistIdentityFromCerere(cerere), cerereId);
}

/**
 * True when an existing registry doc can safely receive the incoming identity (same person).
 * Different email/telefon/nume (when both sides have values) ⇒ collision / different person.
 */
export function isCompatibleJurnalistRecord(
  existing: JurnalistMatchFields | null | undefined,
  incoming: JurnalistIdentityInput | JurnalistMatchFields | null | undefined
): boolean {
  if (!existing || !incoming) return true;

  const eEmail = normalizeJurnalistEmail(existing.email);
  const iEmail = normalizeJurnalistEmail(incoming.email);
  if (eEmail && iEmail && eEmail !== iEmail) return false;

  const eTel = normalizeJurnalistTelefon(existing.telefon);
  const iTel = normalizeJurnalistTelefon(incoming.telefon);
  if (eTel && iTel && eTel !== iTel) return false;

  const eNume = normalizeJurnalistIdPart(String(existing.nume || ""));
  const iNume = normalizeJurnalistIdPart(String((incoming as JurnalistIdentityInput).nume || ""));
  if (eNume && iNume && eNume !== iNume) {
    // Same contact keys ⇒ treat as rename of the same person.
    if (eEmail && iEmail && eEmail === iEmail) return true;
    if (eTel && iTel && eTel === iTel) return true;
    return false;
  }

  return true;
}

/** Secondary id when preferred id (usually = legit) is already occupied by someone else. */
export function disambiguatedJurnalistDocId(
  input: JurnalistIdentityInput,
  preferredId: string,
  attempt = 0
): string {
  const extra = [
    normalizeJurnalistIdPart(String(input.nume || "")),
    normalizeJurnalistIdPart(String(input.email || "").trim().toLowerCase()),
  ].filter(Boolean);
  let base = normalizeJurnalistIdPart([preferredId, ...extra].join("_"));
  if (attempt > 0) base = normalizeJurnalistIdPart(`${base}_${attempt}`);
  return (base || preferredId).slice(0, 80);
}

type JurnalistIdLookup = Map<string, Record<string, any>> | Record<string, Record<string, any> | null | undefined>;

function lookupJurnalistById(lookup: JurnalistIdLookup, id: string): Record<string, any> | null {
  if (lookup instanceof Map) return (lookup.get(id) as Record<string, any> | undefined) || null;
  const v = lookup[id];
  return v && typeof v === "object" ? (v as Record<string, any>) : null;
}

/**
 * Resolve journalist doc id without silently overwriting a different person.
 * Backward compatible: the first journalist keeps `buildJurnalistDocId()` (often = legit).
 * Phone-only ids: reuse legacy docs (0722… / +40…) when present; new ones use 40722….
 * Collisions get a disambiguated id (LEGIT_NUME / LEGIT_NUME_EMAIL / …).
 */
export function resolveJurnalistDocId(
  input: JurnalistIdentityInput,
  existingById: JurnalistIdLookup,
  fallbackSuffix?: string
): string {
  const legacyPhoneId = findExistingPhoneBasedDocId(input, (id) => lookupJurnalistById(existingById, id));
  if (legacyPhoneId) return legacyPhoneId;

  const preferred = buildJurnalistDocId(input, fallbackSuffix);
  const atPreferred = lookupJurnalistById(existingById, preferred);
  if (!atPreferred || isCompatibleJurnalistRecord(atPreferred, input)) return preferred;

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = disambiguatedJurnalistDocId(input, preferred, attempt);
    if (candidate === preferred) continue;
    const existing = lookupJurnalistById(existingById, candidate);
    if (!existing || isCompatibleJurnalistRecord(existing, input)) return candidate;
  }

  const suffix = normalizeJurnalistIdPart(String(fallbackSuffix || `${Date.now()}`));
  return normalizeJurnalistIdPart(`${preferred}_${suffix}`).slice(0, 80) || preferred;
}

export async function resolveJurnalistDocIdAsync(
  input: JurnalistIdentityInput,
  getById: (id: string) => Promise<Record<string, any> | null>,
  fallbackSuffix?: string
): Promise<string> {
  const hasLegit = Boolean(normalizeJurnalistIdPart(String(input.legit || "")));
  const hasEmail = Boolean(normalizeJurnalistIdPart(String(input.email || "").trim().toLowerCase()));
  if (!hasLegit && !hasEmail && String(input.telefon || "").trim()) {
    for (const id of jurnalistPhoneDocIdCandidates(input.telefon)) {
      const existing = await getById(id);
      if (existing && isCompatibleJurnalistRecord(existing, input)) return id;
    }
  }

  const preferred = buildJurnalistDocId(input, fallbackSuffix);
  const atPreferred = await getById(preferred);
  if (!atPreferred || isCompatibleJurnalistRecord(atPreferred, input)) return preferred;

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = disambiguatedJurnalistDocId(input, preferred, attempt);
    if (candidate === preferred) continue;
    const existing = await getById(candidate);
    if (!existing || isCompatibleJurnalistRecord(existing, input)) return candidate;
  }

  const suffix = normalizeJurnalistIdPart(String(fallbackSuffix || `${Date.now()}`));
  return normalizeJurnalistIdPart(`${preferred}_${suffix}`).slice(0, 80) || preferred;
}

export async function resolveJurnalistDocIdFromCerereAsync(
  cerere: Pick<CerereAcreditare, "jurnalist" | "media">,
  cerereId: string,
  getById: (id: string) => Promise<Record<string, any> | null>
): Promise<string> {
  return resolveJurnalistDocIdAsync(jurnalistIdentityFromCerere(cerere), getById, cerereId);
}

export type JurnalistEditDraft = {
  nume?: string;
  email?: string;
  telefon?: string;
  legit?: string;
  redactie?: string;
};

/**
 * Payload for moving a journalist registry doc to a new ID.
 * Preserves accreditation/status fields and any extra keys already stored in production
 * (lastAcreditareYear, lastAcreditareNumar, adresaRedactie, createdAt, etc.).
 */
export function buildJurnalistMovePayload(
  existing: Record<string, any> | null | undefined,
  draft: JurnalistEditDraft,
  updatedAt: unknown
): Record<string, any> {
  const prev = existing && typeof existing === "object" ? { ...existing } : {};
  delete prev.id;
  return {
    ...prev,
    nume: draft.nume ?? prev.nume ?? "",
    email: draft.email ?? prev.email ?? "",
    telefon: draft.telefon ?? prev.telefon ?? "",
    legit: draft.legit ?? prev.legit ?? "",
    redactie: draft.redactie ?? prev.redactie ?? "",
    createdAt: prev.createdAt ?? updatedAt,
    updatedAt,
  };
}

export function normalizeJurnalistEmail(value?: string | null): string {
  return String(value || "").trim().toLowerCase();
}

/**
 * Digits-only international number for https://wa.me/{n} (no "+").
 * Romanian mobiles 07xxxxxxxx / 7xxxxxxxx → 407xxxxxxxx.
 */
export function normalizePhoneForWhatsApp(value?: string | null): string {
  let s = String(value || "").trim();
  if (!s) return "";
  s = s.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("00")) s = s.slice(2);

  // RO mobile
  if (/^07\d{8}$/.test(s)) return `40${s.slice(1)}`;
  if (/^7\d{8}$/.test(s)) return `40${s}`;
  if (/^40\d{9}$/.test(s)) return s;

  // RO landline 02x / 03x (10 digits national)
  if (/^0[23]\d{8}$/.test(s)) return `40${s.slice(1)}`;

  return s;
}

/** Canonical phone for matching / identity (0722… and +40… compare equal). */
export function normalizeJurnalistTelefon(value?: string | null): string {
  const canon = normalizePhoneForWhatsApp(value);
  if (canon) return canon;
  return String(value || "")
    .trim()
    .replace(/[^\d+]/g, "")
    .replace(/(?!^)\+/g, "");
}

/** tel: href — E.164 with leading + when possible. */
export function normalizePhoneForTel(value?: string | null): string {
  const intl = normalizePhoneForWhatsApp(value);
  return intl ? `+${intl}` : "";
}

export type JurnalistMatchFields = {
  nume?: string | null;
  email?: string | null;
  telefon?: string | null;
  legit?: string | null;
  redactie?: string | null;
};

/**
 * Whether an issued Acreditari doc belongs to a journalist registry entry.
 *
 * Matching rules (safe for cascade delete + history):
 * - Matching legitimație ⇒ same person.
 * - Conflicting legitimație ⇒ only soft-match via email/telefon when names agree
 *   (same person after a legit correction; blocks shared redacție email/phone).
 * - Email/telefon alone ⇒ match only when both sides have the same non-empty name
 *   (blocks shared desk contacts when name is missing).
 * - Sparse legacy (no strong keys) ⇒ nume + redacție.
 */
export function acreditareMatchesJurnalist(
  acr: JurnalistMatchFields | null | undefined,
  jurnalist: JurnalistMatchFields | null | undefined
): boolean {
  if (!acr || !jurnalist) return false;

  const jLegit = normalizeJurnalistIdPart(String(jurnalist.legit || ""));
  const aLegit = normalizeJurnalistIdPart(String(acr.legit || ""));
  const jEmail = normalizeJurnalistEmail(jurnalist.email);
  const aEmail = normalizeJurnalistEmail(acr.email);
  const jTel = normalizeJurnalistTelefon(jurnalist.telefon);
  const aTel = normalizeJurnalistTelefon(acr.telefon);
  const jNume = normalizeJurnalistIdPart(String(jurnalist.nume || ""));
  const aNume = normalizeJurnalistIdPart(String(acr.nume || ""));

  const legitMatch = Boolean(jLegit && aLegit && jLegit === aLegit);
  const legitConflict = Boolean(jLegit && aLegit && jLegit !== aLegit);
  const emailMatch = Boolean(jEmail && aEmail && jEmail === aEmail);
  const telMatch = Boolean(jTel && aTel && jTel === aTel);
  const namesAgree = Boolean(jNume && aNume && jNume === aNume);

  if (legitMatch) return true;

  // Different legit ⇒ different people unless soft key + same name (legit was corrected).
  if (legitConflict) {
    return namesAgree && (emailMatch || telMatch);
  }

  // Soft keys require agreeing names — never match on shared email/phone alone
  // when either side lacks a name (newsroom shared contacts).
  if ((emailMatch || telMatch) && namesAgree) return true;

  // Last-resort for sparse legacy docs: same name + redactie when neither side has strong keys.
  const jHasStrong = Boolean(jLegit || jEmail || jTel);
  const aHasStrong = Boolean(aLegit || aEmail || aTel);
  if (!jHasStrong && !aHasStrong) {
    const jRed = normalizeJurnalistIdPart(String(jurnalist.redactie || ""));
    const aRed = normalizeJurnalistIdPart(String(acr.redactie || ""));
    return Boolean(jNume && aNume && jNume === aNume && jRed && aRed && jRed === aRed);
  }

  return false;
}

/** Deterministic issued-accreditation doc id for a cerere + structura pair. */
export function acreditareDocIdForCerere(cerereId: string, structuraKey: StructuraKey | string): string {
  return normalizeJurnalistIdPart(`acr_${cerereId}_${structuraKey}`) || `acr_${cerereId}`;
}

/** Resolves the issued accreditation id for a structura from cerere state. */
export function resolveAcreditareIdForStructura(
  cerere: Pick<CerereAcreditare, "statusByStructura" | "source"> | Record<string, any>,
  structuraKey: StructuraKey | string,
  cerereId: string
): string {
  const fromStatus = String((cerere as any)?.statusByStructura?.[structuraKey]?.acreditareId || "").trim();
  if (fromStatus) return fromStatus;
  const fromSource = String((cerere as any)?.source?.acreditareId || "").trim();
  if (fromSource) return fromSource;
  return acreditareDocIdForCerere(cerereId, structuraKey);
}

export function parseAcreditareNumar(v: unknown): number | null {
  const s = String(v || "").trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ""));
  return null;
}

/** Extracts calendar year from DD/MM/YYYY, DD.MM.YYYY or YYYY-MM-DD labels. */
export function yearFromDateLabel(value?: string | null): number | null {
  const s = String(value || "").trim();
  if (!s) return null;
  let m = s.match(/^(\d{2})[\/.\-](\d{2})[\/.\-](\d{4})$/);
  if (m) return Number(m[3]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return Number(m[1]);
  return null;
}

/** Coerce registry / import year values (number or "2026") into a calendar year. */
export function coerceAcreditareYear(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const y = Math.trunc(value);
    return y >= 1990 && y <= 2100 ? y : null;
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (/^\d{4}$/.test(s)) {
      const y = Number(s);
      return y >= 1990 && y <= 2100 ? y : null;
    }
  }
  return null;
}

/**
 * Accredited for a given calendar year (annual model).
 * Accepts numeric or string years from older/imported docs.
 */
export function isJurnalistAccreditedForYear(
  lastAcreditareYear?: number | string | null,
  year = new Date().getFullYear()
): boolean {
  const y = coerceAcreditareYear(lastAcreditareYear);
  return y != null && y === year;
}

export type JurnalistAccreditationStatus = {
  isCurrent: boolean;
  year: number | null;
  /** Short badge label */
  label: string;
  /** Longer explanation for detail views */
  detail: string;
};

/**
 * Human-readable accreditation status for the annual (calendar-year) model.
 * Makes the Jan 1 transition explicit: previous year ⇒ "necesită reacreditare", not a vague "Neacreditat".
 */
export function getJurnalistAccreditationStatus(
  lastAcreditareYear?: number | string | null,
  year = new Date().getFullYear()
): JurnalistAccreditationStatus {
  const y = coerceAcreditareYear(lastAcreditareYear);
  if (y != null && y === year) {
    return {
      isCurrent: true,
      year: y,
      label: "Acreditat",
      detail: `Acreditat în anul curent (${year})`,
    };
  }
  if (y != null) {
    return {
      isCurrent: false,
      year: y,
      label: `Reacreditare ${year}`,
      detail: `Necesită reacreditare pentru ${year} (ultima acreditare: ${y})`,
    };
  }
  return {
    isCurrent: false,
    year: null,
    label: "Neacreditat",
    detail: `Nu este acreditat în anul curent (${year})`,
  };
}

/**
 * Never lower registry lastAcreditareYear when applying an older certificate
 * (e.g. backfill approve after a newer year already exists).
 * Same year → keep the incoming numar (latest certificate for that year).
 */
export function mergeLastAcreditareFields(
  existing: { lastAcreditareYear?: number | string | null; lastAcreditareNumar?: string | null } | null | undefined,
  incomingYear: number,
  incomingNumar: string
): { lastAcreditareYear: number; lastAcreditareNumar: string } {
  const prevYear = coerceAcreditareYear(existing?.lastAcreditareYear);
  const numar = String(incomingNumar || "").trim();
  if (prevYear != null && prevYear > incomingYear) {
    const keptNumar = String(existing?.lastAcreditareNumar || "").trim();
    return {
      lastAcreditareYear: prevYear,
      lastAcreditareNumar: keptNumar || numar,
    };
  }
  return {
    lastAcreditareYear: incomingYear,
    lastAcreditareNumar: numar,
  };
}

export function acreditareSortTimestamp(data?: string, createdAt?: unknown): number {
  const ymd = String(data || "").trim();
  const m = ymd.match(/^(\d{2})[\/.\-](\d{2})[\/.\-](\d{4})$/);
  if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
  const m2 = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) return new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3])).getTime();
  if (createdAt && typeof createdAt === "object" && createdAt !== null && "toDate" in createdAt) {
    try {
      return (createdAt as { toDate: () => Date }).toDate().getTime();
    } catch {}
  }
  if (typeof createdAt === "string") {
    const t = Date.parse(createdAt);
    if (Number.isFinite(t)) return t;
  }
  return 0;
}

export function sortAcreditariByDateDesc<T extends { data?: string; createdAt?: unknown }>(items: T[]): T[] {
  return [...items].sort((a, b) => acreditareSortTimestamp(b.data, b.createdAt) - acreditareSortTimestamp(a.data, a.createdAt));
}

/**
 * Număr/dată acreditare for a structura.
 * Prefer per-structura fields on statusByStructura[key].
 * Global cerere.acreditare is only a fallback for single-structura / legacy docs —
 * never for multi-structura (avoids showing structura A's number on B's preview/PDF).
 */
export function resolveAcreditareFieldsForStructura(
  cerere: Record<string, any> | null | undefined,
  structuraKey: StructuraKey | string
): { numar: string; data: string } {
  const st = (cerere?.statusByStructura || {})[structuraKey] || {};
  const fromStatusNumar = String(st.acreditareNumar || "").trim();
  const fromStatusData = String(st.acreditareData || "").trim();
  const keys = Array.isArray(cerere?.structuraKeys) ? cerere.structuraKeys : [];
  const allowGlobalFallback = keys.length <= 1;
  const globalNumar = String(cerere?.acreditare?.numar || "").trim();
  const globalData = String(cerere?.acreditare?.data || "").trim();
  return {
    numar: fromStatusNumar || (allowGlobalFallback ? globalNumar : ""),
    data: fromStatusData || (allowGlobalFallback ? globalData : ""),
  };
}

export function cerereHasJurnalistIdentity(cerere: Pick<CerereAcreditare, "jurnalist">): boolean {
  const j = cerere.jurnalist || ({} as CerereAcreditare["jurnalist"]);
  return Boolean(
    String(j.legitimatie?.numar || "").trim() ||
      String(j.email || "").trim() ||
      String(j.telefon?.mobil || j.telefon?.fix || "").trim() ||
      String(j.numePrenume || "").trim()
  );
}

