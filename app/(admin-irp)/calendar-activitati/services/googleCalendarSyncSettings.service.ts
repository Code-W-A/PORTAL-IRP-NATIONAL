import { doc, getDoc, setDoc } from "firebase/firestore";

import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";
import type { GoogleCalendarSyncSettings } from "@/app/(admin-irp)/calendar-activitati/types";

const DEFAULT_SETTINGS: GoogleCalendarSyncSettings = {
  googleIcalUrl: "",
  syncEnabled: false,
  syncIntervalMinutes: 30,
};

function settingsDocPath(judetId: string, structuraId: string) {
  return `Judete/${judetId}/Structuri/${structuraId}/Settings/calendarSync`;
}

function stripUndefined<T extends Record<string, unknown>>(object: T) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined)
  ) as T;
}

export async function loadGoogleCalendarSyncSettings(): Promise<GoogleCalendarSyncSettings> {
  const { db } = initFirebase();
  const { judetId, structuraId } = getTenantContext();
  const snap = await getDoc(doc(db, settingsDocPath(judetId, structuraId)));
  if (!snap.exists()) return { ...DEFAULT_SETTINGS };
  const data = snap.data();
  return {
    googleIcalUrl: String(data.googleIcalUrl || ""),
    syncEnabled: Boolean(data.syncEnabled),
    syncIntervalMinutes: Number(data.syncIntervalMinutes) || 30,
    lastSyncAt: data.lastSyncAt ? String(data.lastSyncAt) : undefined,
    lastSyncStatus:
      data.lastSyncStatus === "ok" || data.lastSyncStatus === "error"
        ? data.lastSyncStatus
        : undefined,
    lastSyncMessage: data.lastSyncMessage ? String(data.lastSyncMessage) : undefined,
    lastSyncStats: data.lastSyncStats as GoogleCalendarSyncSettings["lastSyncStats"],
  };
}

export async function saveGoogleCalendarSyncSettings(
  patch: Partial<GoogleCalendarSyncSettings>
): Promise<GoogleCalendarSyncSettings> {
  const { db, auth } = initFirebase();
  const { judetId, structuraId } = getTenantContext();
  const ref = doc(db, settingsDocPath(judetId, structuraId));
  const current = await loadGoogleCalendarSyncSettings();
  const merged: GoogleCalendarSyncSettings = {
    ...current,
    ...patch,
    syncIntervalMinutes: Math.max(
      15,
      Number(patch.syncIntervalMinutes ?? current.syncIntervalMinutes) || 30
    ),
  };
  await setDoc(
    ref,
    stripUndefined({
      googleIcalUrl: merged.googleIcalUrl,
      syncEnabled: merged.syncEnabled,
      syncIntervalMinutes: merged.syncIntervalMinutes,
      lastSyncAt: merged.lastSyncAt,
      lastSyncStatus: merged.lastSyncStatus,
      lastSyncMessage: merged.lastSyncMessage,
      lastSyncStats: merged.lastSyncStats,
      updatedAt: new Date().toISOString(),
      updatedBy: auth.currentUser?.uid || null,
    }),
    { merge: true }
  );
  return merged;
}

export async function triggerGoogleCalendarSync(
  googleIcalUrl?: string
): Promise<{ ok: boolean; message: string; result?: unknown }> {
  const { auth } = initFirebase();
  const user = auth.currentUser;
  if (!user) throw new Error("Trebuie să fii autentificat.");

  const token = await user.getIdToken();
  const { judetId, structuraId } = getTenantContext();

  const res = await fetch("/api/calendar-activitati/sync-google", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ judetId, structuraId, googleIcalUrl }),
  });

  const data = (await res.json()) as {
    ok?: boolean;
    message?: string;
    error?: string;
    result?: unknown;
  };
  if (!res.ok) {
    throw new Error(data.error || `Sync eșuat (${res.status})`);
  }
  return { ok: true, message: data.message || "Sync finalizat.", result: data.result };
}
