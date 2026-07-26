import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
  writeBatch,
  type Firestore,
} from "firebase/firestore";

import {
  acreditareMatchesJurnalist,
  buildJurnalistDocId,
  buildStructuraKey,
  yearFromDateLabel,
  type JurnalistMatchFields,
} from "@/lib/acreditari";
import { acrLog, acrLogError } from "@/lib/acreditareClientLog";

function identitySnapshot(j: JurnalistMatchFields): Required<Pick<JurnalistMatchFields, "nume" | "email" | "telefon" | "legit" | "redactie">> {
  return {
    nume: String(j.nume || ""),
    email: String(j.email || ""),
    telefon: String(j.telefon || ""),
    legit: String(j.legit || ""),
    redactie: String(j.redactie || ""),
  };
}

function identityUnchanged(a: JurnalistMatchFields, b: JurnalistMatchFields): boolean {
  const x = identitySnapshot(a);
  const y = identitySnapshot(b);
  return (
    x.nume === y.nume &&
    x.email === y.email &&
    x.telefon === y.telefon &&
    x.legit === y.legit &&
    x.redactie === y.redactie
  );
}

/**
 * After a journalist registry identity edit, rewrite matching issued Acreditari
 * contact fields so history / cascade delete keep working when legit/email/phone change.
 * Matches using the *previous* identity, then writes the *next* fields.
 */
export async function syncAcreditariIdentityForJurnalist(args: {
  db: Firestore;
  judetId: string;
  structuraId: string;
  previous: JurnalistMatchFields;
  next: JurnalistMatchFields;
}): Promise<number> {
  const { db, judetId, structuraId, previous, next } = args;
  if (identityUnchanged(previous, next)) return 0;

  acrLog("jurnalisti-sync", "start", { judetId, structuraId });
  try {
    const related = await findAcreditariForJurnalist(db, judetId, structuraId, previous);
    if (related.length === 0) {
      acrLog("jurnalisti-sync", "ok", { judetId, structuraId, updated: 0 });
      return 0;
    }

    const nextFields = identitySnapshot(next);
    const patch = {
      nume: nextFields.nume,
      email: nextFields.email,
      telefon: nextFields.telefon,
      legit: nextFields.legit,
      redactie: nextFields.redactie,
      updatedAt: serverTimestamp(),
    };

    const CHUNK = 400;
    for (let i = 0; i < related.length; i += CHUNK) {
      const batch = writeBatch(db);
      for (const acr of related.slice(i, i + CHUNK)) {
        batch.update(doc(db, `Judete/${judetId}/Structuri/${structuraId}/Acreditari/${acr.id}`), patch);
      }
      await batch.commit();
    }
    acrLog("jurnalisti-sync", "ok", { judetId, structuraId, updated: related.length });
    return related.length;
  } catch (e) {
    acrLogError("jurnalisti-sync", "failed", e, { judetId, structuraId });
    throw e;
  }
}

export type AcreditareRow = JurnalistMatchFields & {
  id: string;
  source?: { cerereId?: string; acreditareId?: string } | null;
  [key: string]: unknown;
};

export async function findAcreditariForJurnalist(
  db: Firestore,
  judetId: string,
  structuraId: string,
  jurnalist: JurnalistMatchFields
): Promise<AcreditareRow[]> {
  const acrColl = collection(doc(db, `Judete/${judetId}/Structuri/${structuraId}`), "Acreditari");
  const all = await getDocs(acrColl);
  return all.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }) as AcreditareRow)
    .filter((row) => acreditareMatchesJurnalist(row, jurnalist));
}

export async function findJurnalistiMatchingAcreditare(
  db: Firestore,
  judetId: string,
  structuraId: string,
  acr: JurnalistMatchFields
): Promise<Array<JurnalistMatchFields & { id: string }>> {
  const jColl = collection(doc(db, `Judete/${judetId}/Structuri/${structuraId}`), "Jurnalisti");
  const snap = await getDocs(jColl);
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((j) => acreditareMatchesJurnalist(acr, j));
}

/** Recompute lastAcreditareYear / Numar from remaining matching Acreditari. */
export async function recalcJurnalistLastAcreditare(
  db: Firestore,
  judetId: string,
  structuraId: string,
  jurnalistId: string,
  jurnalist: JurnalistMatchFields
): Promise<void> {
  const jRef = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Jurnalisti/${jurnalistId}`);
  const jSnap = await getDoc(jRef);
  if (!jSnap.exists()) return;

  const related = await findAcreditariForJurnalist(db, judetId, structuraId, {
    ...jurnalist,
    ...(jSnap.data() as any),
  });

  let bestYear: number | null = null;
  let bestNumar: string | null = null;
  for (const row of related) {
    const y = yearFromDateLabel(String((row as any).data || ""));
    const n = String((row as any).numar || "").trim();
    if (y && (!bestYear || y > bestYear)) {
      bestYear = y;
      bestNumar = n || null;
    }
  }

  await updateDoc(jRef, {
    lastAcreditareYear: bestYear,
    lastAcreditareNumar: bestNumar,
    updatedAt: serverTimestamp(),
  });
}

/** Firestore allows max 500 ops/batch; keep headroom. */
const BATCH_LIMIT = 450;

type BatchOp =
  | { kind: "delete"; ref: ReturnType<typeof doc> }
  | { kind: "update"; ref: ReturnType<typeof doc>; data: Record<string, any> };

type CerereResetState = {
  statusByStructura: Record<string, any>;
  source: Record<string, any>;
};

function applyCerereResetLocal(
  state: CerereResetState,
  acreditareId: string,
  currentKey: string
): void {
  const statusByStructura = { ...(state.statusByStructura || {}) };
  const currentStatus = { ...(statusByStructura[currentKey] || {}) };

  if (currentStatus.status === "approved" && (!currentStatus.acreditareId || currentStatus.acreditareId === acreditareId)) {
    statusByStructura[currentKey] = { status: "pending" };
  } else if (currentStatus.acreditareId === acreditareId) {
    const { acreditareId: _removed, ...rest } = currentStatus;
    statusByStructura[currentKey] = rest;
  }

  const source = { ...(state.source || {}) };
  if (source.acreditareId === acreditareId) {
    delete source.acreditareId;
  }

  state.statusByStructura = statusByStructura;
  state.source = source;
}

async function commitBatchOps(db: Firestore, ops: BatchOp[]): Promise<void> {
  for (let i = 0; i < ops.length; i += BATCH_LIMIT) {
    const chunk = ops.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const op of chunk) {
      if (op.kind === "delete") batch.delete(op.ref);
      else batch.update(op.ref, op.data);
    }
    await batch.commit();
  }
}

/**
 * Deletes one issued acreditare + resets linked cerere + recalcs matching jurnalisti
 * in as few atomic batches as possible (single batch for typical sizes).
 */
export async function deleteIssuedAcreditare(args: {
  db: Firestore;
  judetId: string;
  structuraId: string;
  acreditareId: string;
}): Promise<{ deleted: boolean }> {
  const { db, judetId, structuraId, acreditareId } = args;
  acrLog("lista-delete", "start", { judetId, structuraId, acreditareId });
  const currentKey = buildStructuraKey(judetId, structuraId);
  const acrRef = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Acreditari/${acreditareId}`);
  const acrSnap = await getDoc(acrRef);
  if (!acrSnap.exists()) {
    acrLog("lista-delete", "not_found", { acreditareId });
    return { deleted: false };
  }

  const acr = { id: acrSnap.id, ...(acrSnap.data() as any) } as AcreditareRow;
  const structuraRef = doc(db, `Judete/${judetId}/Structuri/${structuraId}`);

  const cerereId = String(acr?.source?.cerereId || "").trim();
  const [cerereSnap, remainingSnap, jurnalistiSnap] = await Promise.all([
    cerereId ? getDoc(doc(db, "CereriAcreditare", cerereId)) : Promise.resolve(null),
    getDocs(collection(structuraRef, "Acreditari")),
    getDocs(collection(structuraRef, "Jurnalisti")),
  ]);

  const remaining = remainingSnap.docs
    .filter((d) => d.id !== acreditareId)
    .map((d) => ({ id: d.id, ...(d.data() as any) })) as AcreditareRow[];

  let matchedJurnalisti = jurnalistiSnap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((j) => acreditareMatchesJurnalist(acr, j));

  // Backward-compatible fallback: preferred buildJurnalistDocId when matcher finds nothing.
  if (matchedJurnalisti.length === 0) {
    const preferredId = buildJurnalistDocId({
      legit: acr.legit,
      nume: acr.nume,
      email: acr.email,
      telefon: acr.telefon,
      redactie: acr.redactie,
    });
    const preferred = jurnalistiSnap.docs.find((d) => d.id === preferredId);
    if (preferred) matchedJurnalisti = [{ id: preferred.id, ...(preferred.data() as any) }];
  }

  const ops: BatchOp[] = [{ kind: "delete", ref: acrRef }];

  if (cerereId && cerereSnap && "exists" in cerereSnap && cerereSnap.exists()) {
    const cerere = cerereSnap.data() as any;
    const state: CerereResetState = {
      statusByStructura: { ...(cerere.statusByStructura || {}) },
      source: { ...(cerere.source || {}) },
    };
    applyCerereResetLocal(state, acreditareId, currentKey);
    ops.push({
      kind: "update",
      ref: doc(db, "CereriAcreditare", cerereId),
      data: {
        statusByStructura: state.statusByStructura,
        source: state.source,
        updatedAt: serverTimestamp(),
      },
    });
  }

  for (const j of matchedJurnalisti) {
    let bestYear: number | null = null;
    let bestNumar: string | null = null;
    for (const row of remaining) {
      if (!acreditareMatchesJurnalist(row, j)) continue;
      const y = yearFromDateLabel(String((row as any).data || ""));
      const n = String((row as any).numar || "").trim();
      if (y && (!bestYear || y > bestYear)) {
        bestYear = y;
        bestNumar = n || null;
      }
    }
    ops.push({
      kind: "update",
      ref: doc(db, `Judete/${judetId}/Structuri/${structuraId}/Jurnalisti/${j.id}`),
      data: {
        lastAcreditareYear: bestYear,
        lastAcreditareNumar: bestNumar,
        updatedAt: serverTimestamp(),
      },
    });
  }

  try {
    await commitBatchOps(db, ops);
    acrLog("lista-delete", "ok", {
      judetId,
      structuraId,
      acreditareId,
      jurnalistiRecalc: matchedJurnalisti.length,
      cerereId: cerereId || null,
    });
    return { deleted: true };
  } catch (e) {
    acrLogError("lista-delete", "failed", e, { acreditareId, judetId, structuraId });
    throw e;
  }
}

/**
 * Deletes a journalist registry doc. When related issued acreditari exist, requires
 * cascade confirmation and removes them too (cereri reset to pending — same as Lista).
 * Writes are batched; journalist doc is deleted last so a failed mid-run stays retryable.
 */
export async function deleteJurnalistRegistry(args: {
  db: Firestore;
  judetId: string;
  structuraId: string;
  jurnalistId: string;
  jurnalist: JurnalistMatchFields;
  /** Optional: skip first confirm (caller already confirmed). */
  skipInitialConfirm?: boolean;
}): Promise<{ deleted: boolean; acreditariDeleted: number }> {
  const { db, judetId, structuraId, jurnalistId, jurnalist, skipInitialConfirm } = args;
  acrLog("jurnalisti-delete", "start", { judetId, structuraId, jurnalistId });

  if (!skipInitialConfirm) {
    const ok = confirm("Sigur vrei să ștergi acest jurnalist? Acțiunea este ireversibilă.");
    if (!ok) {
      acrLog("jurnalisti-delete", "cancelled_confirm", { jurnalistId });
      return { deleted: false, acreditariDeleted: 0 };
    }
  }

  const related = await findAcreditariForJurnalist(db, judetId, structuraId, jurnalist);
  if (related.length > 0) {
    const okCascade = confirm(
      [
        `Acest jurnalist are ${related.length} acreditări emise în „Lista acreditări”.`,
        "",
        "OK = șterge jurnalistul ȘI acreditările (cererile asociate revin la „în așteptare”).",
        "Cancel = anulează tot (nimic nu este șters).",
      ].join("\n")
    );
    if (!okCascade) {
      acrLog("jurnalisti-delete", "cancelled_cascade", { jurnalistId, related: related.length });
      return { deleted: false, acreditariDeleted: 0 };
    }
  }

  const currentKey = buildStructuraKey(judetId, structuraId);
  const cerereStates = new Map<string, CerereResetState>();

  // Load + fold all cerere resets in memory (multiple acreditari may share one cerere).
  const uniqueCerereIds = Array.from(
    new Set(
      related
        .map((acr) => String(acr?.source?.cerereId || "").trim())
        .filter(Boolean)
    )
  );
  await Promise.all(
    uniqueCerereIds.map(async (cerereId) => {
      const snap = await getDoc(doc(db, "CereriAcreditare", cerereId));
      if (!snap.exists()) return;
      const cerere = snap.data() as any;
      cerereStates.set(cerereId, {
        statusByStructura: { ...(cerere.statusByStructura || {}) },
        source: { ...(cerere.source || {}) },
      });
    })
  );
  for (const acr of related) {
    const cerereId = String(acr?.source?.cerereId || "").trim();
    if (!cerereId) continue;
    const state = cerereStates.get(cerereId);
    if (state) applyCerereResetLocal(state, acr.id, currentKey);
  }

  const jurnalistDeleteOp: BatchOp = {
    kind: "delete",
    ref: doc(db, `Judete/${judetId}/Structuri/${structuraId}/Jurnalisti/${jurnalistId}`),
  };

  const cascadeOps: BatchOp[] = [];
  for (const acr of related) {
    cascadeOps.push({
      kind: "delete",
      ref: doc(db, `Judete/${judetId}/Structuri/${structuraId}/Acreditari/${acr.id}`),
    });
  }
  for (const [cerereId, state] of cerereStates) {
    cascadeOps.push({
      kind: "update",
      ref: doc(db, "CereriAcreditare", cerereId),
      data: {
        statusByStructura: state.statusByStructura,
        source: state.source,
        updatedAt: serverTimestamp(),
      },
    });
  }

  try {
    // Single atomic batch when it fits; otherwise cascade first, journalist last (retryable).
    if (cascadeOps.length + 1 <= BATCH_LIMIT) {
      await commitBatchOps(db, [...cascadeOps, jurnalistDeleteOp]);
    } else {
      if (cascadeOps.length > 0) await commitBatchOps(db, cascadeOps);
      await commitBatchOps(db, [jurnalistDeleteOp]);
    }
    acrLog("jurnalisti-delete", "ok", {
      judetId,
      structuraId,
      jurnalistId,
      acreditariDeleted: related.length,
    });
    return { deleted: true, acreditariDeleted: related.length };
  } catch (e) {
    acrLogError("jurnalisti-delete", "failed", e, { jurnalistId, judetId, structuraId });
    throw e;
  }
}
