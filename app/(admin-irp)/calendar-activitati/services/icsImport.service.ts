import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  writeBatch,
  type Firestore,
} from "firebase/firestore";

import { getTenantContext } from "@/lib/tenant";
import type { ActivityEvent } from "@/app/(admin-irp)/calendar-activitati/types";
import { buildFirestoreActivityEvent, parseIcsToEvents } from "@/app/(admin-irp)/calendar-activitati/utils/ics";

const EVENTS_COLLECTION = "activityEvents";

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function cleanUndefinedDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(cleanUndefinedDeep);
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = cleanUndefinedDeep(v);
    }
    return out;
  }
  return value;
}

function safeDocId(value: string) {
  const trimmed = String(value || "").trim();
  const noSlash = trimmed.replace(/\//g, "_");
  return noSlash.slice(0, 900) || createId();
}

function getTenantRefs(db: Firestore) {
  const { judetId, structuraId } = getTenantContext();
  const root = doc(db, `Judete/${judetId}/Structuri/${structuraId}`);
  const events = collection(root, EVENTS_COLLECTION);
  const general = doc(collection(root, "Settings"), "general");
  const backups = collection(general, "icsBackups");
  return {
    judetId,
    structuraId,
    workspaceId: `${judetId}/${structuraId}`,
    root,
    events,
    general,
    backups,
  };
}

async function commitInChunks<T>(items: T[], chunkSize: number, fn: (chunk: T[]) => Promise<void>) {
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    await fn(chunk);
  }
}

export type IcsBackupReplaceResult = {
  backupId: string;
  existingCount: number;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  errorSamples: Array<{ uid?: string; reason: string }>;
};

export async function importIcsBackupReplace(input: {
  db: Firestore;
  userId: string;
  sources: Array<{ name: string; text: string }>;
}) {
  const tenant = getTenantRefs(input.db);
  const nowIso = new Date().toISOString();

  const parsedAll = input.sources.map((source) => ({
    name: source.name,
    parsed: parseIcsToEvents(source.text, { defaultTimezone: "Europe/Bucharest" }),
  }));

  const parsed = {
    events: parsedAll.flatMap((item) =>
      item.parsed.events.map((eventItem) => ({
        ...eventItem,
        uid: `${item.name}::${eventItem.uid}`,
      }))
    ),
    skipped: parsedAll.reduce((acc, item) => acc + item.parsed.skipped, 0),
    errors: parsedAll.flatMap((item) =>
      item.parsed.errors.map((err) => ({
        uid: err.uid ? `${item.name}::${err.uid}` : undefined,
        reason: err.reason,
      }))
    ),
  };

  const snapshot = await getDocs(tenant.events);
  const existingDocs = snapshot.docs;

  const backupId = createId();
  const backupRef = doc(tenant.backups, backupId);

  await setDoc(backupRef, {
    id: backupId,
    createdAt: nowIso,
    createdByUid: input.userId,
    count: existingDocs.length,
  });

  await commitInChunks(existingDocs, 400, async (chunk) => {
    const batch = writeBatch(input.db);
    for (const d of chunk) {
      batch.set(doc(collection(backupRef, "events"), d.id), d.data());
    }
    await batch.commit();
  });

  await commitInChunks(existingDocs, 400, async (chunk) => {
    const batch = writeBatch(input.db);
    for (const d of chunk) {
      batch.delete(d.ref);
    }
    await batch.commit();
  });

  const toImport = parsed.events;
  await commitInChunks(toImport, 400, async (chunk) => {
    const batch = writeBatch(input.db);
    for (const e of chunk) {
      const id = safeDocId(`ics_${e.uid}_${e.startDateTime}`);
      const event: ActivityEvent = buildFirestoreActivityEvent({
        id,
        nowIso,
        userId: input.userId,
        workspaceId: tenant.workspaceId,
        parsed: e,
      });
      batch.set(doc(tenant.events, id), cleanUndefinedDeep(event) as Record<string, unknown>, { merge: false });
    }
    await batch.commit();
  });

  return {
    backupId,
    existingCount: existingDocs.length,
    importedCount: toImport.length,
    skippedCount: parsed.skipped,
    errorCount: parsed.errors.length,
    errorSamples: parsed.errors.slice(0, 10),
  } satisfies IcsBackupReplaceResult;
}
