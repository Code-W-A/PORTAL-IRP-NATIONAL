import { timingSafeEqual } from "crypto";

import { getBearerToken } from "@/lib/server/auth";

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
