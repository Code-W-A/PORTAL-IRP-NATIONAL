import { doc, getDoc, setDoc, type Firestore } from "firebase/firestore";

import { getTenantDocRef } from "@/app/(admin-irp)/dashboard/raportari/_core/firestore";
import type { RaportariSettingsDoc, ReportTypePeriodPrefs } from "@/app/(admin-irp)/dashboard/raportari/_core/types";

const SETTINGS_DOC_ID = "raportari";

function settingsRef(db: Firestore) {
  return doc(getTenantDocRef(db), "Settings", SETTINGS_DOC_ID);
}

export async function loadRaportariSettings(db: Firestore): Promise<RaportariSettingsDoc> {
  const snap = await getDoc(settingsRef(db));
  if (!snap.exists()) return { byTypeId: {} };
  const raw = snap.data() as RaportariSettingsDoc;
  return {
    byTypeId: raw?.byTypeId && typeof raw.byTypeId === "object" ? raw.byTypeId : {},
  };
}

export async function saveRaportariTypePrefs(
  db: Firestore,
  typeId: string,
  prefs: ReportTypePeriodPrefs
) {
  const current = await loadRaportariSettings(db);
  await setDoc(
    settingsRef(db),
    {
      byTypeId: {
        ...current.byTypeId,
        [typeId]: {
          ...current.byTypeId?.[typeId],
          ...prefs,
        },
      },
    },
    { merge: true }
  );
}

export function getTypePrefs(
  settings: RaportariSettingsDoc | null | undefined,
  typeId: string
): ReportTypePeriodPrefs | null {
  return settings?.byTypeId?.[typeId] ?? null;
}
