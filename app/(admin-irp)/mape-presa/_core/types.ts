export type PressKitConference = {
  date: string;
  time: string;
  year: string;
};

export type PressKitContact = {
  name: string;
  role: string;
  phone: string;
  email: string;
};

export type PressKitInstitutionContact = {
  address: string;
  phoneFax: string;
  email: string;
  website: string;
};

export type PressKitLeadership = {
  inspectorSef: string;
  primAdjunct: string;
  adjunct: string;
};

export type PressKitSpokesperson = {
  name: string;
  email: string;
  phone: string;
};

export type JournalistRow = {
  fullNameAndRole: string;
  trust: string;
};

export const DEFAULT_PRESS_KIT_INVITATION_NOTE =
  "Invitația la activitate a fost transmisă prin grija purtătorului de cuvânt de la ISU DÂMBOVIȚA";

export function buildDefaultConferenceMaterialTitle(year: string) {
  return `1. Evaluare anuală a activității inspectoratului pe anul ${String(year || "").trim()}`;
}

export type PressKitConferenceMaterial = {
  title: string;
  content: string;
};

export type PressKitPayload = {
  conference: PressKitConference;
  conferenceMaterial: PressKitConferenceMaterial;
  contact: PressKitContact;
  hosts: string[];
  institutionContact: PressKitInstitutionContact;
  leadership: PressKitLeadership;
  spokesperson: PressKitSpokesperson;
  journalists: JournalistRow[];
  intocmit: {
    name: string;
  };
  invitationNote: string;
};

export type PressKitReusableSections = Omit<
  PressKitPayload,
  "conference" | "conferenceMaterial"
>;

export type PressKitDoc = PressKitPayload & {
  id: string;
  judetId?: string;
  structuraId?: string;
  createdByUid?: string | null;
  createdByEmail?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export type PressKitDefaultsDoc = PressKitReusableSections & {
  updatedAt?: unknown;
  updatedByUid?: string | null;
  updatedByEmail?: string | null;
  sourcePressKitId?: string | null;
};
