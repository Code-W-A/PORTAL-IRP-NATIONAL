export type AuthUser = { uid: string; email?: string | null };

function getApiKey() {
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!key) throw new Error("Missing NEXT_PUBLIC_FIREBASE_API_KEY");
  return key;
}

export function getBearerToken(req: Request): string | null {
  const h = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export async function requireBearerToken(req: Request): Promise<string> {
  const t = getBearerToken(req);
  if (!t) throw new Error("missing_auth");
  return t;
}

export async function lookupUserFromIdToken(idToken: string): Promise<AuthUser> {
  const key = getApiKey();
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("invalid_token");
  const data = (await res.json()) as any;
  const u = Array.isArray(data?.users) ? data.users[0] : null;
  const uid = String(u?.localId || "");
  if (!uid) throw new Error("invalid_token");
  const email = u?.email ? String(u.email) : null;
  return { uid, email };
}


