type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { stringValue: string }
  | { bytesValue: string }
  | { referenceValue: string }
  | { geoPointValue: { latitude: number; longitude: number } }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

function decodeValue(v?: FirestoreValue): any {
  if (!v) return undefined;
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("stringValue" in v) return v.stringValue;
  if ("bytesValue" in v) return v.bytesValue;
  if ("referenceValue" in v) return v.referenceValue;
  if ("geoPointValue" in v) return v.geoPointValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(decodeValue);
  if ("mapValue" in v) {
    const out: Record<string, any> = {};
    const fields = v.mapValue.fields || {};
    for (const [k, vv] of Object.entries(fields)) out[k] = decodeValue(vv);
    return out;
  }
  return undefined;
}

export type FirestoreRestDoc = {
  name: string;
  fields?: Record<string, FirestoreValue>;
  createTime?: string;
  updateTime?: string;
};

function encodeValue(v: any): FirestoreValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") {
    if (Number.isInteger(v)) return { integerValue: String(v) };
    return { doubleValue: v };
  }
  if (typeof v === "string") {
    // Heuristic: allow caller to pass ISO timestamp strings explicitly as timestampValue via special object
    return { stringValue: v };
  }
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
  if (typeof v === "object") {
    // Special marker: { __timestamp: "..." } or { __timestamp: Date }
    if (v.__timestamp) {
      const t = v.__timestamp instanceof Date ? v.__timestamp.toISOString() : String(v.__timestamp);
      return { timestampValue: t };
    }
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, vv] of Object.entries(v)) fields[k] = encodeValue(vv);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function encodeFields(obj: Record<string, any>): Record<string, FirestoreValue> {
  const out: Record<string, FirestoreValue> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = encodeValue(v);
  return out;
}

function getProjectId() {
  const pid = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!pid) throw new Error("Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID");
  return pid;
}

function docUrl(docPath: string) {
  // docPath like: "CereriAcreditare/abc" or "users/uid"
  const pid = getProjectId();
  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(pid)}/databases/(default)/documents/`;
  return base + docPath.split("/").map(encodeURIComponent).join("/");
}

function collectionUrl(collectionPath: string) {
  const pid = getProjectId();
  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(pid)}/databases/(default)/documents/`;
  return base + collectionPath.split("/").map(encodeURIComponent).join("/");
}

function runQueryUrl(parentDocPath?: string) {
  const pid = getProjectId();
  const base = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(pid)}/databases/(default)/documents`;
  if (!parentDocPath) return `${base}:runQuery`;
  return `${base}/${parentDocPath.split("/").map(encodeURIComponent).join("/")}:runQuery`;
}

function docIdFromName(name: string): string {
  const parts = String(name || "").split("/");
  return parts[parts.length - 1] || "";
}

export type FirestoreFieldFilterOp =
  | "LESS_THAN"
  | "LESS_THAN_OR_EQUAL"
  | "GREATER_THAN"
  | "GREATER_THAN_OR_EQUAL"
  | "EQUAL"
  | "NOT_EQUAL";

export type FirestoreQueryFilter = {
  field: string;
  op: FirestoreFieldFilterOp;
  value: any;
};

function toStructuredFilter(filter: FirestoreQueryFilter) {
  return {
    fieldFilter: {
      field: { fieldPath: filter.field },
      op: filter.op,
      value: encodeValue(filter.value),
    },
  };
}

/**
 * Read-only collection query via Firestore REST `runQuery`.
 * `parentDocPath` is the parent document, e.g. `Judete/DB/Structuri/ISU`.
 */
export async function firestoreQueryCollection<T = any>(
  parentDocPath: string,
  collectionId: string,
  idToken: string,
  opts?: {
    filters?: FirestoreQueryFilter[];
    orderBy?: { field: string; direction?: "ASCENDING" | "DESCENDING" };
    pageSize?: number;
    maxDocs?: number;
  }
): Promise<Array<{ id: string; data: T }>> {
  const pageSize = Math.min(300, Math.max(1, opts?.pageSize || 200));
  const maxDocs = Math.min(2000, Math.max(1, opts?.maxDocs || 1500));
  const filters = opts?.filters || [];
  const out: Array<{ id: string; data: T }> = [];
  let cursor: FirestoreValue[] | null = null;

  while (out.length < maxDocs) {
    const structuredQuery: Record<string, any> = {
      from: [{ collectionId }],
      limit: Math.min(pageSize, maxDocs - out.length),
    };

    if (filters.length === 1) {
      structuredQuery.where = toStructuredFilter(filters[0]);
    } else if (filters.length > 1) {
      structuredQuery.where = {
        compositeFilter: {
          op: "AND",
          filters: filters.map(toStructuredFilter),
        },
      };
    }

    if (opts?.orderBy) {
      structuredQuery.orderBy = [
        { field: { fieldPath: opts.orderBy.field }, direction: opts.orderBy.direction || "ASCENDING" },
      ];
    }

    if (cursor) {
      structuredQuery.startAt = { values: cursor, before: false };
    }

    const res = await fetch(runQueryUrl(parentDocPath), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ structuredQuery }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`firestore_query_failed:${res.status}`);

    const rows = (await res.json()) as Array<{ document?: FirestoreRestDoc }>;
    const docs = (Array.isArray(rows) ? rows : []).filter((row) => row?.document?.name);
    if (!docs.length) break;

    let lastDoc: FirestoreRestDoc | null = null;
    let added = 0;
    for (const row of docs) {
      const doc = row.document!;
      const id = docIdFromName(doc.name);
      lastDoc = doc;
      if (out.some((item) => item.id === id)) continue;
      const fields = doc.fields || {};
      const data: Record<string, any> = {};
      for (const [k, v] of Object.entries(fields)) data[k] = decodeValue(v as any);
      out.push({ id, data: data as T });
      added += 1;
      if (out.length >= maxDocs) break;
    }

    if (!lastDoc || added === 0 || docs.length < structuredQuery.limit) break;
    if (!opts?.orderBy) break;
    const lastVal = lastDoc.fields?.[opts.orderBy.field];
    if (!lastVal) break;
    cursor = [lastVal];
  }

  return out;
}

function decodeRestDoc(doc: FirestoreRestDoc): { id: string; data: Record<string, any> } {
  const fields = doc.fields || {};
  const data: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) data[k] = decodeValue(v as any);
  return { id: docIdFromName(doc.name), data };
}

/** Read-only list of a collection, e.g. `Judete/DB/Structuri/ISU/Comunicate`. */
export async function firestoreListCollection<T = any>(
  collectionPath: string,
  idToken: string,
  opts?: { pageSize?: number; maxDocs?: number }
): Promise<Array<{ id: string; data: T }>> {
  const pageSize = Math.min(300, Math.max(1, opts?.pageSize || 200));
  const maxDocs = Math.min(2000, Math.max(1, opts?.maxDocs || 400));
  const out: Array<{ id: string; data: T }> = [];
  let pageToken = "";

  while (out.length < maxDocs) {
    const limit = Math.min(pageSize, maxDocs - out.length);
    const params = new URLSearchParams({ pageSize: String(limit) });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`${collectionUrl(collectionPath)}?${params.toString()}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${idToken}` },
      cache: "no-store",
    });
    if (res.status === 404) break;
    if (!res.ok) throw new Error(`firestore_list_failed:${res.status}`);
    const json = (await res.json()) as { documents?: FirestoreRestDoc[]; nextPageToken?: string };
    const docs = Array.isArray(json.documents) ? json.documents : [];
    for (const doc of docs) {
      if (!doc?.name) continue;
      const decoded = decodeRestDoc(doc);
      out.push({ id: decoded.id, data: decoded.data as T });
      if (out.length >= maxDocs) break;
    }
    pageToken = String(json.nextPageToken || "");
    if (!pageToken || docs.length < limit) break;
  }

  return out;
}

export async function firestoreGetDocAsJson<T = any>(docPath: string, idToken: string): Promise<T | null> {
  const res = await fetch(docUrl(docPath), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`firestore_get_failed:${res.status}`);
  const doc = (await res.json()) as FirestoreRestDoc;
  const fields = doc.fields || {};
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = decodeValue(v as any);
  return out as T;
}

export async function firestorePatchDoc(docPath: string, idToken: string, patch: Record<string, any>): Promise<void> {
  const mask = Object.keys(patch)
    .filter(Boolean)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join("&");
  const url = mask ? `${docUrl(docPath)}?${mask}` : docUrl(docPath);
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: encodeFields(patch) }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`firestore_patch_failed:${res.status}`);
}

export async function firestoreCreateDoc(collectionPath: string, idToken: string, doc: Record<string, any>, documentId?: string): Promise<string> {
  const url = documentId ? `${collectionUrl(collectionPath)}?documentId=${encodeURIComponent(documentId)}` : collectionUrl(collectionPath);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: encodeFields(doc) }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`firestore_create_failed:${res.status}`);
  const created = (await res.json()) as FirestoreRestDoc;
  const name = String(created?.name || "");
  return name.split("/").pop() || "";
}

function databaseUrl() {
  const pid = getProjectId();
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(pid)}/databases/(default)`;
}

function absoluteDocName(docPath: string) {
  const pid = getProjectId();
  return `projects/${pid}/databases/(default)/documents/${docPath}`;
}

/**
 * Atomically allocates the next `acreditareLastNumar` on Settings/general via a
 * Firestore read/write transaction (retries on contention).
 */
export async function firestoreAllocateNextAcreditareNumar(
  settingsDocPath: string,
  idToken: string,
  opts?: { floor?: number; maxAttempts?: number }
): Promise<number> {
  const floor = Math.max(0, Number(opts?.floor || 0) || 0);
  const maxAttempts = Math.max(1, Number(opts?.maxAttempts || 8) || 8);
  const authHeaders = {
    Authorization: `Bearer ${idToken}`,
    "Content-Type": "application/json",
  };

  // Lightweight structured log without importing full logger (avoid cycles); keep domain tag.
  const logAlloc = (action: string, meta?: Record<string, unknown>) => {
    console.log(
      "[acreditari]",
      JSON.stringify({
        ts: new Date().toISOString(),
        level: action.includes("fail") || action.includes("error") ? "error" : "info",
        domain: "acreditari",
        area: "allocate",
        action,
        settingsDocPath,
        floor,
        ...meta,
      })
    );
  };

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const beginRes = await fetch(`${databaseUrl()}/documents:beginTransaction`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ options: { readWrite: {} } }),
        cache: "no-store",
      });
      if (!beginRes.ok) throw new Error(`firestore_begin_tx_failed:${beginRes.status}`);
      const beginJson = (await beginRes.json()) as { transaction?: string };
      const transaction = String(beginJson.transaction || "");
      if (!transaction) throw new Error("firestore_begin_tx_empty");

      const absName = absoluteDocName(settingsDocPath);
      const batchRes = await fetch(`${databaseUrl()}/documents:batchGet`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ documents: [absName], transaction }),
        cache: "no-store",
      });
      if (!batchRes.ok) throw new Error(`firestore_tx_get_failed:${batchRes.status}`);
      const batchJson = await batchRes.json();
      const entries = (Array.isArray(batchJson) ? batchJson : [batchJson]) as Array<{
        found?: FirestoreRestDoc;
        missing?: string;
      }>;
      const entry = entries.find((e) => e?.found || e?.missing) || entries[0] || null;
      const exists = Boolean(entry?.found);
      let last = 0;
      if (entry?.found?.fields?.acreditareLastNumar) {
        const raw = decodeValue(entry.found.fields.acreditareLastNumar as FirestoreValue);
        last = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
      }

      const next = Math.max(last, floor) + 1;
      const write: Record<string, any> = {
        update: {
          name: absName,
          fields: encodeFields({ acreditareLastNumar: next }),
        },
      };
      if (exists) {
        write.updateMask = { fieldPaths: ["acreditareLastNumar"] };
      } else {
        write.currentDocument = { exists: false };
      }

      const commitRes = await fetch(`${databaseUrl()}/documents:commit`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ transaction, writes: [write] }),
        cache: "no-store",
      });
      if (!commitRes.ok) {
        // Contention / aborted transaction — retry.
        if (commitRes.status === 409 || commitRes.status === 429 || commitRes.status === 503) {
          lastErr = new Error(`firestore_commit_aborted:${commitRes.status}`);
          continue;
        }
        const body = await commitRes.text().catch(() => "");
        // ABORTED often surfaces as 400 with status ABORTED in body.
        if (/ABORTED|aborted|contention/i.test(body)) {
          lastErr = new Error(`firestore_commit_aborted:${commitRes.status}`);
          continue;
        }
        throw new Error(`firestore_commit_failed:${commitRes.status}`);
      }

      logAlloc("ok", { next, last, attempt: attempt + 1 });
      return next;
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (/aborted|begin_tx|tx_get/i.test(msg) && attempt < maxAttempts - 1) {
        logAlloc("retry", { attempt: attempt + 1, message: msg });
        continue;
      }
      logAlloc("failed", { attempt: attempt + 1, message: msg });
      throw e;
    }
  }

  logAlloc("failed_exhausted", {
    maxAttempts,
    message: lastErr instanceof Error ? lastErr.message : String(lastErr || "error"),
  });
  throw lastErr instanceof Error ? lastErr : new Error("firestore_allocate_numar_failed");
}


