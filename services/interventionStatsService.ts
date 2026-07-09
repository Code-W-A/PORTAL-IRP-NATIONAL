import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  type Firestore,
} from "firebase/firestore";

import {
  getTenantContext,
  interventionRecordsCollectionPath,
  interventionTypesCollectionPath,
} from "@/lib/tenant";
import type {
  InterventionRecord,
  InterventionRecordDraft,
  InterventionType,
  InterventionTypeDraft,
} from "@/types/interventionStats";

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function stripUndefined<T extends Record<string, unknown>>(object: T) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
  ) as T;
}

function normalizeIso(value: unknown, fallback?: string) {
  const raw = asString(value);
  if (raw) {
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return fallback || new Date().toISOString();
}

function getTypesCollectionRef(db: Firestore) {
  const { judetId, structuraId } = getTenantContext();
  return collection(db, interventionTypesCollectionPath(judetId, structuraId));
}

function getRecordsCollectionRef(db: Firestore) {
  const { judetId, structuraId } = getTenantContext();
  return collection(db, interventionRecordsCollectionPath(judetId, structuraId));
}

export function normalizeInterventionTypeDoc(raw: Record<string, unknown>, id: string): InterventionType {
  const nowIso = new Date().toISOString();
  return {
    id,
    name: asString(raw.name).trim(),
    enabled: asBoolean(raw.enabled, true),
    sortOrder: Number(raw.sortOrder) || 0,
    createdAt: normalizeIso(raw.createdAt, nowIso),
    createdBy: asString(raw.createdBy),
  };
}

export function normalizeInterventionRecordDoc(raw: Record<string, unknown>, id: string): InterventionRecord {
  const nowIso = new Date().toISOString();
  const bicpComunicatId = asString(raw.bicpComunicatId) || undefined;
  const bicpComunicatLabel = asString(raw.bicpComunicatLabel) || undefined;

  return {
    id,
    typeId: asString(raw.typeId),
    typeName: asString(raw.typeName),
    occurredAt: normalizeIso(raw.occurredAt, nowIso),
    communicated: asBoolean(raw.communicated),
    bicpComunicatId,
    bicpComunicatLabel,
    createdAt: normalizeIso(raw.createdAt, nowIso),
    createdBy: asString(raw.createdBy),
  };
}

function normalizeTypeDraft(draft: InterventionTypeDraft): InterventionTypeDraft {
  return {
    name: String(draft.name || "").trim(),
    enabled: draft.enabled !== false,
    sortOrder: Number(draft.sortOrder) || 0,
  };
}

function normalizeRecordDraft(draft: InterventionRecordDraft): InterventionRecordDraft {
  const bicpComunicatId = draft.bicpComunicatId ? String(draft.bicpComunicatId).trim() : undefined;
  const bicpComunicatLabel = draft.bicpComunicatLabel ? String(draft.bicpComunicatLabel).trim() : undefined;

  return {
    typeId: String(draft.typeId || "").trim(),
    occurredAt: normalizeIso(draft.occurredAt),
    communicated: !!draft.communicated,
    bicpComunicatId,
    bicpComunicatLabel,
  };
}

export async function listInterventionTypes(db: Firestore) {
  const col = getTypesCollectionRef(db);
  const snapshot = await getDocs(col);
  return snapshot.docs
    .map((item) => normalizeInterventionTypeDoc(item.data() as Record<string, unknown>, item.id))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "ro"));
}

export async function getInterventionType(db: Firestore, id: string) {
  const col = getTypesCollectionRef(db);
  const snap = await getDoc(doc(col, id));
  if (!snap.exists()) return null;
  return normalizeInterventionTypeDoc(snap.data() as Record<string, unknown>, snap.id);
}

export async function createInterventionType(
  db: Firestore,
  draft: InterventionTypeDraft,
  userId: string
) {
  const normalized = normalizeTypeDraft(draft);
  if (!normalized.name) throw new Error("type_name_required");

  const existing = await listInterventionTypes(db);
  const duplicate = existing.some(
    (item) => item.name.localeCompare(normalized.name, "ro", { sensitivity: "accent" }) === 0
  );
  if (duplicate) throw new Error("type_name_duplicate");

  const nowIso = new Date().toISOString();
  const id = createId();
  const type: InterventionType = {
    id,
    ...normalized,
    sortOrder: normalized.sortOrder || existing.length,
    createdAt: nowIso,
    createdBy: userId,
  };

  const col = getTypesCollectionRef(db);
  await setDoc(doc(col, id), stripUndefined(type as unknown as Record<string, unknown>), { merge: false });
  return type;
}

export async function updateInterventionType(
  db: Firestore,
  id: string,
  patch: Partial<InterventionTypeDraft>,
  userId: string
) {
  const col = getTypesCollectionRef(db);
  const ref = doc(col, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("type_not_found");

  const current = normalizeInterventionTypeDoc(snap.data() as Record<string, unknown>, snap.id);
  const merged = normalizeTypeDraft({ ...current, ...patch });
  if (!merged.name) throw new Error("type_name_required");

  const existing = await listInterventionTypes(db);
  const duplicate = existing.some(
    (item) =>
      item.id !== id &&
      item.name.localeCompare(merged.name, "ro", { sensitivity: "accent" }) === 0
  );
  if (duplicate) throw new Error("type_name_duplicate");

  const updated: InterventionType = {
    ...current,
    ...merged,
    createdBy: current.createdBy || userId,
  };

  await setDoc(ref, stripUndefined(updated as unknown as Record<string, unknown>), { merge: true });
  return updated;
}

export async function deleteInterventionType(db: Firestore, id: string) {
  const col = getTypesCollectionRef(db);
  await deleteDoc(doc(col, id));
}

export async function listInterventionRecords(db: Firestore) {
  const col = getRecordsCollectionRef(db);
  const snapshot = await getDocs(col);
  return snapshot.docs
    .map((item) => normalizeInterventionRecordDoc(item.data() as Record<string, unknown>, item.id))
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
}

export async function getInterventionRecord(db: Firestore, id: string) {
  const col = getRecordsCollectionRef(db);
  const snap = await getDoc(doc(col, id));
  if (!snap.exists()) return null;
  return normalizeInterventionRecordDoc(snap.data() as Record<string, unknown>, snap.id);
}

export async function createInterventionRecord(
  db: Firestore,
  draft: InterventionRecordDraft,
  userId: string
) {
  const normalized = normalizeRecordDraft(draft);
  if (!normalized.typeId) throw new Error("type_required");
  if (!normalized.occurredAt) throw new Error("occurred_at_required");

  const type = await getInterventionType(db, normalized.typeId);
  if (!type) throw new Error("type_not_found");

  const nowIso = new Date().toISOString();
  const id = createId();
  const record: InterventionRecord = {
    id,
    typeId: type.id,
    typeName: type.name,
    occurredAt: normalized.occurredAt,
    communicated: normalized.communicated,
    bicpComunicatId: normalized.bicpComunicatId,
    bicpComunicatLabel: normalized.bicpComunicatLabel,
    createdAt: nowIso,
    createdBy: userId,
  };

  const col = getRecordsCollectionRef(db);
  await setDoc(doc(col, id), stripUndefined(record as unknown as Record<string, unknown>), { merge: false });
  return record;
}

export async function updateInterventionRecord(
  db: Firestore,
  id: string,
  patch: Partial<InterventionRecordDraft>,
  userId: string
) {
  const col = getRecordsCollectionRef(db);
  const ref = doc(col, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("record_not_found");

  const current = normalizeInterventionRecordDoc(snap.data() as Record<string, unknown>, snap.id);
  const merged = normalizeRecordDraft({ ...current, ...patch });

  let typeName = current.typeName;
  if (patch.typeId && patch.typeId !== current.typeId) {
    const type = await getInterventionType(db, merged.typeId);
    if (!type) throw new Error("type_not_found");
    typeName = type.name;
  }

  const updated: InterventionRecord = {
    ...current,
    ...merged,
    typeName,
    createdBy: current.createdBy || userId,
  };

  await setDoc(ref, stripUndefined(updated as unknown as Record<string, unknown>), { merge: true });
  return updated;
}

export async function deleteInterventionRecord(db: Firestore, id: string) {
  const col = getRecordsCollectionRef(db);
  await deleteDoc(doc(col, id));
}

export function validateInterventionTypeDraft(draft: InterventionTypeDraft): string[] {
  const errors: string[] = [];
  if (!draft.name?.trim()) errors.push("Denumirea tipului este obligatorie.");
  return errors;
}

export function validateInterventionRecordDraft(draft: InterventionRecordDraft): string[] {
  const errors: string[] = [];
  if (!draft.typeId?.trim()) errors.push("Tipul intervenției este obligatoriu.");
  if (!draft.occurredAt) errors.push("Data intervenției este obligatorie.");
  return errors;
}
