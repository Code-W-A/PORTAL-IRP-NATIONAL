import type { Timestamp } from "firebase/firestore";

export type StructuraKey = `${string}_${string}`; // `${judetId}_${structuraId}`

export type CerereStatus = "pending" | "approved" | "rejected";

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
  };

  attachments?: null | {
    legitimatie?: { path: string; name?: string; contentType?: string; size?: number };
    semnatura?: { path: string; contentType?: string };
  };

  attachmentsUploadedAt?: Timestamp;
};

export function buildStructuraKey(judetId: string, structuraId: string): StructuraKey {
  return `${String(judetId).toUpperCase()}_${String(structuraId).toUpperCase()}` as StructuraKey;
}


