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


