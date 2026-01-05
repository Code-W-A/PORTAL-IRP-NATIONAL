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
  statusByStructura: Record<StructuraKey, { status: CerereStatus; decidedAt?: Timestamp; decidedByUid?: string }>;

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


