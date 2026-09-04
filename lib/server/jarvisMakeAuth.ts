import { timingSafeEqual } from "crypto";

import { getBearerToken } from "@/lib/server/auth";
import { getTenantFromIdToken } from "@/lib/settings/getSettings";

export const JARVIS_ISU_DB_TENANT = {
  judetId: "DB",
  structuraId: "ISU",
  label: "ISU Dâmbovița",
} as const;

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function getJarvisMakeApiKey() {
  return String(process.env.JARVIS_MAKE_API_KEY || "").trim();
}

export function readMakeApiKey(req: Request) {
  const header = String(req.headers.get("x-api-key") || req.headers.get("X-Api-Key") || "").trim();
  if (header) return header;
  return getBearerToken(req);
}

export function isJarvisMakeRequest(req: Request) {
  const expected = getJarvisMakeApiKey();
  const provided = readMakeApiKey(req);
  return Boolean(expected && provided && safeEqual(provided, expected));
}

export function requireJarvisMakeApiKey(req: Request) {
  const expected = getJarvisMakeApiKey();
  if (!expected) throw new Error("missing_env:JARVIS_MAKE_API_KEY");
  const provided = readMakeApiKey(req);
  if (!provided || !safeEqual(provided, expected)) throw new Error("invalid_api_key");
}

type CachedReaderToken = {
  idToken: string;
  expiresAt: number;
};

let cachedReader: CachedReaderToken | null = null;

function firebaseWebApiKey() {
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!key) throw new Error("missing_env:NEXT_PUBLIC_FIREBASE_API_KEY");
  return key;
}

async function signInWithPassword(email: string, password: string) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(
    firebaseWebApiKey()
  )}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("invalid_reader_credentials");
  const data = (await res.json()) as { idToken?: string; expiresIn?: string };
  const idToken = String(data.idToken || "");
  if (!idToken) throw new Error("invalid_reader_credentials");
  const expiresInMs = Math.max(60, Number(data.expiresIn || 3600)) * 1000;
  return { idToken, expiresAt: Date.now() + expiresInMs - 60_000 };
}

/** Signs in as a normal ISU DB user. No Firebase Admin / service account. */
export async function getJarvisReaderIdToken() {
  if (cachedReader && cachedReader.expiresAt > Date.now()) return cachedReader.idToken;

  const email = String(process.env.JARVIS_FIREBASE_EMAIL || "").trim();
  const password = String(process.env.JARVIS_FIREBASE_PASSWORD || "");
  if (!email || !password) throw new Error("missing_env:JARVIS_FIREBASE_EMAIL");

  const signedIn = await signInWithPassword(email, password);
  const tenant = await getTenantFromIdToken(signedIn.idToken);
  if (tenant.judetId !== JARVIS_ISU_DB_TENANT.judetId || tenant.structuraId !== JARVIS_ISU_DB_TENANT.structuraId) {
    throw new Error("tenant_mismatch");
  }

  cachedReader = signedIn;
  return signedIn.idToken;
}
