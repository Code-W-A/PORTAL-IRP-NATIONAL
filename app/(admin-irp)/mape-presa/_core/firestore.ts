import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  type Firestore,
} from "firebase/firestore";

import {
  DEFAULT_PRESS_KIT_INVITATION_NOTE,
  buildDefaultConferenceMaterialTitle,
} from "@/app/(admin-irp)/mape-presa/_core/types";
import type {
  PressKitDefaultsDoc,
  PressKitDoc,
  PressKitPayload,
  PressKitReusableSections,
} from "@/app/(admin-irp)/mape-presa/_core/types";

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeHosts(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function normalizeJournalists(value: unknown): PressKitPayload["journalists"] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item: any) => ({
      fullNameAndRole: asString(item?.fullNameAndRole).trim(),
      trust: asString(item?.trust).trim(),
    }))
    .filter((item) => item.fullNameAndRole || item.trust);
}

function normalizeConferenceMaterial(value: unknown): PressKitPayload["conferenceMaterial"] {
  const raw = value as any;
  return {
    title: asString(raw?.title).trim(),
    content: asString(raw?.content).trim(),
  };
}

function normalizeReusableSections(raw: any): PressKitReusableSections {
  const invitationNoteRaw = asString(raw?.invitationNote).trim();
  return {
    contact: {
      name: asString(raw?.contact?.name).trim(),
      role: asString(raw?.contact?.role).trim(),
      phone: asString(raw?.contact?.phone).trim(),
      email: asString(raw?.contact?.email).trim(),
    },
    hosts: normalizeHosts(raw?.hosts),
    institutionContact: {
      address: asString(raw?.institutionContact?.address).trim(),
      phoneFax: asString(raw?.institutionContact?.phoneFax).trim(),
      email: asString(raw?.institutionContact?.email).trim(),
      website: asString(raw?.institutionContact?.website).trim(),
    },
    leadership: {
      inspectorSef: asString(raw?.leadership?.inspectorSef).trim(),
      primAdjunct: asString(raw?.leadership?.primAdjunct).trim(),
      adjunct: asString(raw?.leadership?.adjunct).trim(),
    },
    spokesperson: {
      name: asString(raw?.spokesperson?.name).trim(),
      email: asString(raw?.spokesperson?.email).trim(),
      phone: asString(raw?.spokesperson?.phone).trim(),
    },
    journalists: normalizeJournalists(raw?.journalists),
    intocmit: {
      name: asString(raw?.intocmit?.name).trim(),
    },
    invitationNote: invitationNoteRaw || DEFAULT_PRESS_KIT_INVITATION_NOTE,
  };
}

export function createEmptyPressKitPayload(): PressKitPayload {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");

  return {
    conference: {
      date: `${dd}.${mm}.${yyyy}`,
      time: `${hh}:${min}`,
      year: String(yyyy),
    },
    conferenceMaterial: {
      title: buildDefaultConferenceMaterialTitle(String(yyyy)),
      content: "",
    },
    contact: {
      name: "",
      role: "",
      phone: "",
      email: "",
    },
    hosts: [""],
    institutionContact: {
      address: "",
      phoneFax: "",
      email: "",
      website: "",
    },
    leadership: {
      inspectorSef: "",
      primAdjunct: "",
      adjunct: "",
    },
    spokesperson: {
      name: "",
      email: "",
      phone: "",
    },
    journalists: [{ fullNameAndRole: "", trust: "" }],
    intocmit: {
      name: "",
    },
    invitationNote: DEFAULT_PRESS_KIT_INVITATION_NOTE,
  };
}

export function normalizePressKitDoc(raw: any, id: string): PressKitDoc {
  return {
    id,
    conference: {
      date: asString(raw?.conference?.date).trim(),
      time: asString(raw?.conference?.time).trim(),
      year: asString(raw?.conference?.year).trim(),
    },
    conferenceMaterial: normalizeConferenceMaterial(raw?.conferenceMaterial),
    ...normalizeReusableSections(raw),
    judetId: asString(raw?.judetId).trim(),
    structuraId: asString(raw?.structuraId).trim(),
    createdByUid: raw?.createdByUid ?? null,
    createdByEmail: raw?.createdByEmail ?? null,
    createdAt: raw?.createdAt,
    updatedAt: raw?.updatedAt,
  };
}

function asTimestampMillis(value: unknown) {
  try {
    if (value && typeof value === "object" && "toMillis" in value) {
      return Number((value as any).toMillis?.() || 0);
    }
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  } catch {}
  return 0;
}

export function sortPressKitsByUpdatedAtDesc(items: PressKitDoc[]) {
  return [...items].sort((left, right) => {
    const l = asTimestampMillis(left.updatedAt) || asTimestampMillis(left.createdAt);
    const r = asTimestampMillis(right.updatedAt) || asTimestampMillis(right.createdAt);
    return r - l;
  });
}

export function getPressKitCollection(db: Firestore, judetId: string, structuraId: string) {
  return collection(doc(db, `Judete/${judetId}/Structuri/${structuraId}`), "MapePresa");
}

export function getPressKitDefaultsDocRef(db: Firestore, judetId: string, structuraId: string) {
  return doc(db, `Judete/${judetId}/Structuri/${structuraId}/Settings/mapePresaDefaults`);
}

export function extractReusableSections(payload: PressKitPayload): PressKitReusableSections {
  const normalized = normalizeReusableSections(payload);
  return {
    ...normalized,
    hosts: normalized.hosts.length ? normalized.hosts : [""],
    journalists: normalized.journalists.length
      ? normalized.journalists
      : [{ fullNameAndRole: "", trust: "" }],
  };
}

export function applyReusableSections(
  payload: PressKitPayload,
  reusable: PressKitReusableSections | null | undefined
): PressKitPayload {
  if (!reusable) return payload;
  const normalized = normalizeReusableSections(reusable);
  return {
    ...payload,
    contact: normalized.contact,
    hosts: normalized.hosts.length ? normalized.hosts : [""],
    institutionContact: normalized.institutionContact,
    leadership: normalized.leadership,
    spokesperson: normalized.spokesperson,
    journalists: normalized.journalists.length
      ? normalized.journalists
      : [{ fullNameAndRole: "", trust: "" }],
    intocmit: normalized.intocmit,
  };
}

export function normalizePressKitDefaultsDoc(raw: any): PressKitDefaultsDoc {
  return {
    ...normalizeReusableSections(raw),
    updatedAt: raw?.updatedAt,
    updatedByUid: raw?.updatedByUid ?? null,
    updatedByEmail: raw?.updatedByEmail ?? null,
    sourcePressKitId: raw?.sourcePressKitId ?? null,
  };
}

export async function getLatestPressKitDoc(
  db: Firestore,
  judetId: string,
  structuraId: string
): Promise<PressKitDoc | null> {
  const collectionRef = getPressKitCollection(db, judetId, structuraId);

  const fromUpdated = await getDocs(query(collectionRef, orderBy("updatedAt", "desc"), limit(1)));
  if (!fromUpdated.empty) {
    const row = fromUpdated.docs[0];
    return normalizePressKitDoc(row.data(), row.id);
  }

  const fromCreated = await getDocs(query(collectionRef, orderBy("createdAt", "desc"), limit(1)));
  if (!fromCreated.empty) {
    const row = fromCreated.docs[0];
    return normalizePressKitDoc(row.data(), row.id);
  }

  return null;
}

export async function getPressKitDefaultsDoc(
  db: Firestore,
  judetId: string,
  structuraId: string
): Promise<PressKitDefaultsDoc | null> {
  const ref = getPressKitDefaultsDocRef(db, judetId, structuraId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return normalizePressKitDefaultsDoc(snap.data());
}
