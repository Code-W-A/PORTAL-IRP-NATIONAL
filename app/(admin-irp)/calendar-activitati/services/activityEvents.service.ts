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
import { normalizeUnknownToIso } from "@/app/(admin-irp)/calendar-activitati/utils/datetime";
import type {
  ActivityEvent,
  ActivityEventDraft,
  ActivityRecurrence,
  RecurrenceFrequency,
} from "@/app/(admin-irp)/calendar-activitati/types";

const COLLECTION_NAME = "activityEvents";

type TenantScope = {
  judetId: string;
  structuraId: string;
  workspaceId: string;
};

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function getScope(): TenantScope {
  const { judetId, structuraId } = getTenantContext();
  return {
    judetId,
    structuraId,
    workspaceId: `${judetId}/${structuraId}`,
  };
}

function getCollectionRef(db: Firestore, scope: TenantScope) {
  const parent = doc(db, `Judete/${scope.judetId}/Structuri/${scope.structuraId}`);
  return collection(parent, COLLECTION_NAME);
}

function normalizeFrequency(value: unknown): RecurrenceFrequency {
  if (value === "daily" || value === "weekly" || value === "monthly" || value === "yearly") {
    return value;
  }
  return "none";
}

function sanitizeIsoList(values: unknown, fallback: string) {
  if (!Array.isArray(values)) return undefined;
  const normalized = values
    .map((value) => normalizeUnknownToIso(value, fallback))
    .filter(Boolean);
  return normalized.length ? Array.from(new Set(normalized)) : undefined;
}

function sanitizeRecurrence(raw: unknown, startDateTime: string): ActivityRecurrence | undefined {
  if (!raw || typeof raw !== "object") return undefined;

  const source = raw as Record<string, unknown>;

  const timezoneRaw = typeof source.timezone === "string" ? source.timezone.trim() : "";
  const timezone = timezoneRaw || undefined;

  const rruleRaw = typeof source.rrule === "string" ? source.rrule.trim() : "";
  const rrule = rruleRaw || undefined;

  const exdate = sanitizeIsoList(source.exdate, startDateTime);
  const rdate = sanitizeIsoList(source.rdate, startDateTime);

  const freq = normalizeFrequency(source.freq);
  if (freq === "none" && !rrule && !exdate && !rdate && !timezone) return { freq: "none" };

  const interval = Math.max(1, Number(source.interval || 1));
  const byWeekDays = Array.isArray((source as { byWeekDays?: unknown[] }).byWeekDays)
    ? Array.from(
        new Set(
          ((source as { byWeekDays?: unknown[] }).byWeekDays || [])
            .map((value) => Number(value))
            .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
        )
      )
    : undefined;

  const byMonthDayRaw = Number(source.byMonthDay);
  const byMonthDay = Number.isInteger(byMonthDayRaw)
    ? Math.max(1, Math.min(31, byMonthDayRaw))
    : undefined;

  const countRaw = Number(source.count);
  const count = Number.isInteger(countRaw) && countRaw > 0 ? countRaw : undefined;

  const untilRaw = source.until;
  const until = untilRaw ? normalizeUnknownToIso(untilRaw, startDateTime) : undefined;

  const normalized: ActivityRecurrence = {
    freq,
    interval,
    timezone,
    rrule,
    exdate,
    rdate,
  };

  if (freq === "weekly" && byWeekDays && byWeekDays.length > 0) {
    normalized.byWeekDays = byWeekDays;
  }

  if ((freq === "monthly" || freq === "yearly") && byMonthDay) {
    normalized.byMonthDay = byMonthDay;
  }

  if (count) {
    normalized.count = count;
  }

  if (until) {
    normalized.until = until;
  }

  return normalized;
}

function stripUndefined<T extends Record<string, unknown>>(object: T) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
  ) as T;
}

function normalizeEventDoc(
  id: string,
  raw: Record<string, unknown>,
  scope: TenantScope
): ActivityEvent {
  const nowIso = new Date().toISOString();
  const startDateTime = normalizeUnknownToIso(raw.startDateTime, nowIso);
  const endDateTime = normalizeUnknownToIso(raw.endDateTime, startDateTime);

  const recurrence = sanitizeRecurrence(raw.recurrence, startDateTime);

  const sourceRaw = raw.source;
  const source =
    sourceRaw === "google_calendar" || sourceRaw === "manual" ? sourceRaw : undefined;

  return {
    id,
    title: typeof raw.title === "string" ? raw.title : "Activitate",
    description: typeof raw.description === "string" ? raw.description : undefined,
    startDateTime,
    endDateTime,
    allDay: raw.allDay === true,
    location: typeof raw.location === "string" ? raw.location : undefined,
    category: typeof raw.category === "string" ? raw.category : undefined,
    color: typeof raw.color === "string" ? raw.color : undefined,
    recurrence,
    createdAt: normalizeUnknownToIso(raw.createdAt, nowIso),
    updatedAt: normalizeUnknownToIso(raw.updatedAt, nowIso),
    userId: typeof raw.userId === "string" ? raw.userId : "",
    workspaceId:
      typeof raw.workspaceId === "string" && raw.workspaceId
        ? raw.workspaceId
        : scope.workspaceId,
    source,
    externalUid: typeof raw.externalUid === "string" ? raw.externalUid : undefined,
  };
}

function toFirestoreDoc(event: ActivityEvent) {
  return stripUndefined({
    id: event.id,
    title: event.title,
    description: event.description,
    startDateTime: event.startDateTime,
    endDateTime: event.endDateTime,
    allDay: event.allDay === true,
    location: event.location,
    category: event.category,
    color: event.color,
    recurrence: event.recurrence,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    userId: event.userId,
    workspaceId: event.workspaceId,
    source: event.source,
    externalUid: event.externalUid,
  });
}

function normalizeDraft(draft: ActivityEventDraft): ActivityEventDraft {
  return {
    title: String(draft.title || "").trim(),
    description: draft.description ? String(draft.description).trim() : undefined,
    startDateTime: String(draft.startDateTime || ""),
    endDateTime: String(draft.endDateTime || ""),
    allDay: draft.allDay === true,
    location: draft.location ? String(draft.location).trim() : undefined,
    category: draft.category ? String(draft.category).trim() : undefined,
    color: draft.color ? String(draft.color).trim() : undefined,
    recurrence: draft.recurrence
      ? sanitizeRecurrence(draft.recurrence, draft.startDateTime)
      : undefined,
  };
}

export async function listActivityEvents(db: Firestore) {
  const scope = getScope();
  const snapshot = await getDocs(getCollectionRef(db, scope));

  return snapshot.docs
    .map((item) => normalizeEventDoc(item.id, item.data() as Record<string, unknown>, scope))
    .sort((left, right) => {
      if (left.startDateTime === right.startDateTime) {
        return left.title.localeCompare(right.title, "ro");
      }
      return left.startDateTime.localeCompare(right.startDateTime);
    });
}

export async function createActivityEvent(
  db: Firestore,
  draft: ActivityEventDraft,
  userId: string
) {
  const scope = getScope();
  const normalizedDraft = normalizeDraft(draft);

  const nowIso = new Date().toISOString();
  const id = createId();

  const event: ActivityEvent = {
    id,
    title: normalizedDraft.title,
    description: normalizedDraft.description,
    startDateTime: normalizedDraft.startDateTime,
    endDateTime: normalizedDraft.endDateTime,
    allDay: normalizedDraft.allDay,
    location: normalizedDraft.location,
    category: normalizedDraft.category,
    color: normalizedDraft.color,
    recurrence: normalizedDraft.recurrence,
    createdAt: nowIso,
    updatedAt: nowIso,
    userId,
    workspaceId: scope.workspaceId,
    source: "manual",
  };

  await setDoc(doc(getCollectionRef(db, scope), id), toFirestoreDoc(event), { merge: false });
  return event;
}

export async function updateActivityEvent(
  db: Firestore,
  eventId: string,
  patch: Partial<ActivityEventDraft>,
  userId: string
) {
  const scope = getScope();
  const eventRef = doc(getCollectionRef(db, scope), eventId);
  const snapshot = await getDoc(eventRef);

  if (!snapshot.exists()) {
    throw new Error("activity_event_not_found");
  }

  const currentEvent = normalizeEventDoc(
    snapshot.id,
    snapshot.data() as Record<string, unknown>,
    scope
  );

  const mergedDraft = normalizeDraft({
    title: patch.title ?? currentEvent.title,
    description: patch.description ?? currentEvent.description,
    startDateTime: patch.startDateTime ?? currentEvent.startDateTime,
    endDateTime: patch.endDateTime ?? currentEvent.endDateTime,
    allDay: patch.allDay ?? currentEvent.allDay,
    location: patch.location ?? currentEvent.location,
    category: patch.category ?? currentEvent.category,
    color: patch.color ?? currentEvent.color,
    recurrence: patch.recurrence ?? currentEvent.recurrence,
  });

  const updatedEvent: ActivityEvent = {
    ...currentEvent,
    ...mergedDraft,
    updatedAt: new Date().toISOString(),
    userId: currentEvent.userId || userId,
    workspaceId: currentEvent.workspaceId || scope.workspaceId,
  };

  await setDoc(eventRef, toFirestoreDoc(updatedEvent), { merge: true });
  return updatedEvent;
}

export async function deleteActivityEvent(db: Firestore, eventId: string) {
  const scope = getScope();
  await deleteDoc(doc(getCollectionRef(db, scope), eventId));
}
