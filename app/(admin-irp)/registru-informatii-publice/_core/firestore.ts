import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  type Firestore,
} from "firebase/firestore";

import { getTenantContext } from "@/lib/tenant";
import { buildSearchKeywords } from "./searchKeywords";
import type {
  PublicInfoChangeHistoryEntry,
  PublicInfoRequest,
  PublicInfoRequestDraft,
  PublicInfoRequesterType,
  PublicInfoRequestType,
} from "./types";

export const COLLECTION_NAME = "publicInformationRequests";

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
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

function normalizeRequestType(value: unknown): PublicInfoRequestType {
  return value === "verbal" ? "verbal" : "written";
}

function normalizeRequesterType(value: unknown): PublicInfoRequesterType {
  return value === "persoana_juridica" ? "persoana_juridica" : "person_fizica";
}

function normalizeChangeHistory(raw: unknown): PublicInfoChangeHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => ({
      changedAt: normalizeIso((entry as { changedAt?: unknown })?.changedAt),
      changedBy: asString((entry as { changedBy?: unknown })?.changedBy),
      changedFields: Array.isArray((entry as { changedFields?: unknown })?.changedFields)
        ? ((entry as { changedFields?: unknown[] }).changedFields || []).map((field) => String(field))
        : [],
    }))
    .filter((entry) => entry.changedBy);
}

export function getTenantDocRef(db: Firestore) {
  const { judetId, structuraId } = getTenantContext();
  return doc(db, `Judete/${judetId}/Structuri/${structuraId}`);
}

export function getRequestsCollection(db: Firestore) {
  return collection(getTenantDocRef(db), COLLECTION_NAME);
}

export function normalizeRequestDoc(raw: Record<string, unknown>, id: string): PublicInfoRequest {
  const nowIso = new Date().toISOString();
  const requestDate = normalizeIso(raw.requestDate, nowIso);
  const draft: PublicInfoRequestDraft = {
    requestNumber: asString(raw.requestNumber),
    requestDate,
    requestType: normalizeRequestType(raw.requestType),
    receiveMethod: asString(raw.receiveMethod),
    requesterName: asString(raw.requesterName),
    requesterType: normalizeRequesterType(raw.requesterType),
    requestedInformation: asString(raw.requestedInformation),
    interestDomain: asString(raw.interestDomain),
    responseNature: asString(raw.responseNature),
    communicationMethod: asString(raw.communicationMethod),
    termDays:
      raw.termDays === undefined || raw.termDays === null || raw.termDays === ""
        ? undefined
        : Number(raw.termDays),
    responseNumber: asString(raw.responseNumber) || undefined,
    responseDate: raw.responseDate ? normalizeIso(raw.responseDate) : undefined,
    internalNotes: asString(raw.internalNotes) || undefined,
  };

  const keywordsRaw = Array.isArray(raw.searchKeywords)
    ? raw.searchKeywords.map((item) => String(item))
    : buildSearchKeywords(draft);

  return {
    id,
    ...draft,
    searchKeywords: keywordsRaw,
    changeHistory: normalizeChangeHistory(raw.changeHistory),
    createdAt: normalizeIso(raw.createdAt, nowIso),
    updatedAt: normalizeIso(raw.updatedAt, nowIso),
    createdBy: asString(raw.createdBy),
    updatedBy: asString(raw.updatedBy),
  };
}

function normalizeDraft(draft: PublicInfoRequestDraft): PublicInfoRequestDraft {
  const termDays =
    draft.termDays === undefined || draft.termDays === null || Number.isNaN(Number(draft.termDays))
      ? undefined
      : Number(draft.termDays);

  return {
    requestNumber: String(draft.requestNumber || "").trim(),
    requestDate: normalizeIso(draft.requestDate),
    requestType: normalizeRequestType(draft.requestType),
    receiveMethod: String(draft.receiveMethod || "").trim(),
    requesterName: String(draft.requesterName || "").trim(),
    requesterType: normalizeRequesterType(draft.requesterType),
    requestedInformation: String(draft.requestedInformation || "").trim(),
    interestDomain: String(draft.interestDomain || "").trim(),
    responseNature: String(draft.responseNature || "").trim(),
    communicationMethod: String(draft.communicationMethod || "").trim(),
    termDays,
    responseNumber: draft.responseNumber ? String(draft.responseNumber).trim() : undefined,
    responseDate: draft.responseDate ? normalizeIso(draft.responseDate) : undefined,
    internalNotes: draft.internalNotes ? String(draft.internalNotes).trim() : undefined,
  };
}

function toFirestoreDoc(request: PublicInfoRequest) {
  return stripUndefined({
    id: request.id,
    requestNumber: request.requestNumber,
    requestDate: request.requestDate,
    requestType: request.requestType,
    receiveMethod: request.receiveMethod,
    requesterName: request.requesterName,
    requesterType: request.requesterType,
    requestedInformation: request.requestedInformation,
    interestDomain: request.interestDomain,
    responseNature: request.responseNature,
    communicationMethod: request.communicationMethod,
    termDays: request.termDays,
    responseNumber: request.responseNumber,
    responseDate: request.responseDate,
    internalNotes: request.internalNotes,
    searchKeywords: request.searchKeywords,
    changeHistory: request.changeHistory,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    createdBy: request.createdBy,
    updatedBy: request.updatedBy,
  });
}

function diffFields(before: PublicInfoRequest, after: PublicInfoRequestDraft) {
  const fields: string[] = [];
  (Object.keys(after) as Array<keyof PublicInfoRequestDraft>).forEach((key) => {
    const left = before[key];
    const right = after[key];
    if (String(left ?? "") !== String(right ?? "")) {
      fields.push(key);
    }
  });
  return fields;
}

export async function listPublicInfoRequests(db: Firestore) {
  const snapshot = await getDocs(getRequestsCollection(db));
  return snapshot.docs
    .map((item) => normalizeRequestDoc(item.data() as Record<string, unknown>, item.id))
    .sort((left, right) => right.requestDate.localeCompare(left.requestDate));
}

export async function getPublicInfoRequest(db: Firestore, id: string) {
  const ref = doc(getRequestsCollection(db), id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return normalizeRequestDoc(snap.data() as Record<string, unknown>, snap.id);
}

export async function createPublicInfoRequest(
  db: Firestore,
  draft: PublicInfoRequestDraft,
  userId: string
) {
  const normalized = normalizeDraft(draft);
  const nowIso = new Date().toISOString();
  const id = createId();
  const request: PublicInfoRequest = {
    id,
    ...normalized,
    searchKeywords: buildSearchKeywords(normalized),
    changeHistory: [],
    createdAt: nowIso,
    updatedAt: nowIso,
    createdBy: userId,
    updatedBy: userId,
  };

  await setDoc(doc(getRequestsCollection(db), id), toFirestoreDoc(request), { merge: false });
  return request;
}

export async function updatePublicInfoRequest(
  db: Firestore,
  id: string,
  patch: Partial<PublicInfoRequestDraft>,
  userId: string
) {
  const ref = doc(getRequestsCollection(db), id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("request_not_found");

  const current = normalizeRequestDoc(snap.data() as Record<string, unknown>, snap.id);
  const merged = normalizeDraft({ ...current, ...patch });
  const changedFields = diffFields(current, merged);
  const nowIso = new Date().toISOString();

  const updated: PublicInfoRequest = {
    ...current,
    ...merged,
    searchKeywords: buildSearchKeywords(merged),
    changeHistory:
      changedFields.length > 0
        ? [
            ...current.changeHistory,
            { changedAt: nowIso, changedBy: userId, changedFields },
          ].slice(-50)
        : current.changeHistory,
    updatedAt: nowIso,
    updatedBy: userId,
  };

  await setDoc(ref, toFirestoreDoc(updated), { merge: true });
  return updated;
}

export async function deletePublicInfoRequest(db: Firestore, id: string) {
  await deleteDoc(doc(getRequestsCollection(db), id));
}

export async function duplicatePublicInfoRequest(db: Firestore, id: string, userId: string) {
  const current = await getPublicInfoRequest(db, id);
  if (!current) throw new Error("request_not_found");

  const draft: PublicInfoRequestDraft = {
    requestNumber: "",
    requestDate: new Date().toISOString(),
    requestType: current.requestType,
    receiveMethod: current.receiveMethod,
    requesterName: current.requesterName,
    requesterType: current.requesterType,
    requestedInformation: current.requestedInformation,
    interestDomain: current.interestDomain,
    responseNature: "în lucru",
    communicationMethod: current.communicationMethod,
    termDays: current.termDays,
    internalNotes: current.internalNotes,
  };

  return createPublicInfoRequest(db, draft, userId);
}

export function validatePublicInfoDraft(draft: PublicInfoRequestDraft): string[] {
  const errors: string[] = [];
  if (!draft.requestDate) errors.push("Data cererii este obligatorie.");
  if (!draft.requestType) errors.push("Tipul solicitării este obligatoriu.");
  if (!draft.receiveMethod?.trim()) errors.push("Modalitatea de primire este obligatorie.");
  if (!draft.requesterName?.trim()) errors.push("Numele solicitantului este obligatoriu.");
  if (!draft.requestedInformation?.trim()) errors.push("Informațiile solicitate sunt obligatorii.");
  if (!draft.requesterType) errors.push("Tipul solicitantului este obligatoriu.");
  return errors;
}

export function validatePublicInfoWarnings(draft: PublicInfoRequestDraft): string[] {
  const warnings: string[] = [];
  if (draft.responseNumber && !draft.responseDate) {
    warnings.push("Ai completat numărul răspunsului, dar lipsește data răspunsului.");
  }
  if (draft.responseDate && !draft.responseNumber) {
    warnings.push("Ai completat data răspunsului, dar lipsește numărul răspunsului.");
  }
  return warnings;
}
