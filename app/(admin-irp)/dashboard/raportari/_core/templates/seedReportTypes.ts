import { doc, getDoc, serverTimestamp, setDoc, type Firestore } from "firebase/firestore";

import { getReportTypesCollection } from "@/app/(admin-irp)/dashboard/raportari/_core/firestore";
import type { ReportTypeDoc } from "@/app/(admin-irp)/dashboard/raportari/_core/types";

import {
  ACTIVITATI_IMPACT_COLUMNS,
  ACTIVITATI_IMPACT_TYPE,
  ACTIVITATI_IMPACT_TYPE_ID,
} from "./activitatiImpact";
import {
  INTENTII_MEDIATIZARE_COLUMNS,
  INTENTII_MEDIATIZARE_TYPE,
  INTENTII_MEDIATIZARE_TYPE_ID,
} from "./intentiiMediatizare";

type SeedDefinition = {
  id: string;
  type: Omit<ReportTypeDoc, "createdAt" | "updatedAt">;
  columns: ReportTypeDoc["columns"];
};

const SEED_DEFINITIONS: SeedDefinition[] = [
  {
    id: INTENTII_MEDIATIZARE_TYPE_ID,
    type: INTENTII_MEDIATIZARE_TYPE,
    columns: INTENTII_MEDIATIZARE_COLUMNS,
  },
  {
    id: ACTIVITATI_IMPACT_TYPE_ID,
    type: ACTIVITATI_IMPACT_TYPE,
    columns: ACTIVITATI_IMPACT_COLUMNS,
  },
];

async function seedTypeIfMissing(db: Firestore, definition: SeedDefinition) {
  const coll = getReportTypesCollection(db);
  const ref = doc(coll, definition.id);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return normalizeSeededType(snap.data(), snap.id, definition);
  }

  const payload = {
    ...definition.type,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload, { merge: false });
  return definition.type as ReportTypeDoc;
}

function normalizeSeededType(
  raw: Record<string, unknown>,
  id: string,
  definition: SeedDefinition
): ReportTypeDoc {
  return {
    id,
    name: String(raw.name || definition.type.name),
    description: String(raw.description || definition.type.description),
    columns: definition.columns,
    archived: Boolean(raw.archived),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export async function seedReportTypesIfMissing(db: Firestore) {
  await Promise.all(SEED_DEFINITIONS.map((definition) => seedTypeIfMissing(db, definition)));
}
