import type { Firestore } from "firebase-admin/firestore";

import type { ActivityEvent } from "@/app/(admin-irp)/calendar-activitati/types";
import {
  buildFirestoreActivityEvent,
  parseIcsToEvents,
} from "@/app/(admin-irp)/calendar-activitati/utils/ics";

export type GoogleCalendarSyncScope = {
  judetId: string;
  structuraId: string;
  workspaceId: string;
};

export type GoogleCalendarSyncResult = {
  created: number;
  updated: number;
  removed: number;
  skipped: number;
  errors: number;
  errorSamples: Array<{ uid?: string; reason: string }>;
};

const COLLECTION_NAME = "activityEvents";
const ALLOWED_HOSTS = ["calendar.google.com", "www.google.com"];

function eventsCollection(db: Firestore, scope: GoogleCalendarSyncScope) {
  return db.collection(
    `Judete/${scope.judetId}/Structuri/${scope.structuraId}/${COLLECTION_NAME}`
  );
}

function safeGcalDocId(uid: string) {
  const cleaned = uid.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 220);
  return `gcal_${cleaned || "unknown"}`;
}

export function validateGoogleIcalUrl(raw: string): string {
  const url = raw.trim();
  if (!url) throw new Error("URL-ul iCal Google este gol.");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("URL iCal invalid.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("URL-ul trebuie să fie HTTPS.");
  }
  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    throw new Error("URL-ul trebuie să fie de la calendar.google.com (link secret iCal).");
  }
  if (!parsed.pathname.includes("/ical/") && !parsed.pathname.includes("/private-")) {
    throw new Error("Nu pare un link iCal Google Calendar. Copiază „Adresă secretă în format iCal”.");
  }
  return url;
}

export async function fetchGoogleIcalText(url: string): Promise<string> {
  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "text/calendar, text/plain, */*" },
    cache: "no-store",
    redirect: "follow",
  });
  if (!res.ok) {
    throw new Error(`Nu am putut descărca calendarul Google (${res.status}). Verifică link-ul secret.`);
  }
  const text = await res.text();
  if (!text.includes("BEGIN:VCALENDAR")) {
    throw new Error("Răspunsul nu conține un calendar ICS valid.");
  }
  return text;
}

function stripUndefined<T extends Record<string, unknown>>(object: T) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
  ) as T;
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

export async function syncGoogleCalendarToFirestore(input: {
  db: Firestore;
  scope: GoogleCalendarSyncScope;
  icalUrl: string;
  userId: string;
}): Promise<GoogleCalendarSyncResult> {
  const url = validateGoogleIcalUrl(input.icalUrl);
  const icsText = await fetchGoogleIcalText(url);
  const parsed = parseIcsToEvents(icsText, { defaultTimezone: "Europe/Bucharest" });

  const col = eventsCollection(input.db, input.scope);
  const nowIso = new Date().toISOString();
  const seenUids = new Set<string>();

  let created = 0;
  let updated = 0;

  for (const item of parsed.events) {
    const uid = `google::${item.uid}`;
    seenUids.add(uid);
    const docId = safeGcalDocId(uid);
    const ref = col.doc(docId);
    const existing = await ref.get();

    const base = buildFirestoreActivityEvent({
      id: docId,
      nowIso,
      userId: input.userId,
      workspaceId: input.scope.workspaceId,
      parsed: item,
    });

    const event: ActivityEvent = {
      ...base,
      category: base.category || "Google Calendar",
      source: "google_calendar",
      externalUid: uid,
      createdAt: existing.exists
        ? String(existing.data()?.createdAt || nowIso)
        : nowIso,
      updatedAt: nowIso,
    };

    await ref.set(toFirestoreDoc(event), { merge: false });
    if (existing.exists) updated += 1;
    else created += 1;
  }

  let removed = 0;
  const snapshot = await col.where("source", "==", "google_calendar").get();
  const batch = input.db.batch();
  let batchCount = 0;

  for (const docSnap of snapshot.docs) {
    const externalUid = String(docSnap.data()?.externalUid || "");
    if (externalUid && !seenUids.has(externalUid)) {
      batch.delete(docSnap.ref);
      batchCount += 1;
      removed += 1;
      if (batchCount >= 400) {
        await batch.commit();
        batchCount = 0;
      }
    }
  }
  if (batchCount > 0) await batch.commit();

  return {
    created,
    updated,
    removed,
    skipped: parsed.skipped,
    errors: parsed.errors.length,
    errorSamples: parsed.errors.slice(0, 10),
  };
}
