import { createHmac, timingSafeEqual } from "crypto";

export type AcreditarePdfTokenPayload = {
  acreditareId: string;
  judetId: string;
  structuraId: string;
  exp: number; // unix seconds
};

function getTokenSecret(): string {
  // Dedicated secret only — do not fall back to Firebase/SMTP keys (rotation breaks links
  // and couples download tokens to unrelated credentials).
  const secret = String(process.env.ACREDITARE_PDF_TOKEN_SECRET || "").trim();
  if (!secret) throw new Error("missing_pdf_token_secret");
  return secret;
}

function b64urlEncode(input: string | Buffer): string {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf.toString("base64url");
}

function b64urlDecodeToString(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signRaw(data: string): string {
  return createHmac("sha256", getTokenSecret()).update(data).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Default link lifetime for journalist email downloads (30 days). */
export function defaultAcreditarePdfTokenTtlSeconds(): number {
  const days = Number(process.env.ACREDITARE_PDF_TOKEN_TTL_DAYS || 30);
  if (!Number.isFinite(days) || days <= 0) return 30 * 24 * 60 * 60;
  return Math.trunc(days) * 24 * 60 * 60;
}

export function createAcreditarePdfToken(
  args: Omit<AcreditarePdfTokenPayload, "exp"> & { ttlSeconds?: number }
): string {
  const ttl = args.ttlSeconds ?? defaultAcreditarePdfTokenTtlSeconds();
  const payload: AcreditarePdfTokenPayload = {
    acreditareId: String(args.acreditareId || "").trim(),
    judetId: String(args.judetId || "").toUpperCase(),
    structuraId: String(args.structuraId || "").toUpperCase(),
    exp: Math.floor(Date.now() / 1000) + Math.max(60, ttl),
  };
  if (!payload.acreditareId || !payload.judetId || !payload.structuraId) {
    throw new Error("invalid_pdf_token_payload");
  }
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = signRaw(body);
  return `${body}.${sig}`;
}

export function verifyAcreditarePdfToken(
  token: string,
  expected: { acreditareId: string; judetId: string; structuraId: string }
): { ok: true; payload: AcreditarePdfTokenPayload } | { ok: false; reason: string } {
  const raw = String(token || "").trim();
  const parts = raw.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [body, sig] = parts;
  if (!body || !sig) return { ok: false, reason: "malformed" };

  let expectedSig: string;
  try {
    expectedSig = signRaw(body);
  } catch {
    return { ok: false, reason: "misconfigured" };
  }
  if (!safeEqual(sig, expectedSig)) return { ok: false, reason: "bad_signature" };

  let payload: AcreditarePdfTokenPayload;
  try {
    payload = JSON.parse(b64urlDecodeToString(body)) as AcreditarePdfTokenPayload;
  } catch {
    return { ok: false, reason: "bad_payload" };
  }

  const acreditareId = String(payload?.acreditareId || "").trim();
  const judetId = String(payload?.judetId || "").toUpperCase();
  const structuraId = String(payload?.structuraId || "").toUpperCase();
  const exp = Number(payload?.exp || 0);
  if (!acreditareId || !judetId || !structuraId || !Number.isFinite(exp)) {
    return { ok: false, reason: "bad_payload" };
  }
  if (exp < Math.floor(Date.now() / 1000)) return { ok: false, reason: "expired" };

  if (
    acreditareId !== String(expected.acreditareId || "").trim() ||
    judetId !== String(expected.judetId || "").toUpperCase() ||
    structuraId !== String(expected.structuraId || "").toUpperCase()
  ) {
    return { ok: false, reason: "mismatch" };
  }

  return { ok: true, payload: { acreditareId, judetId, structuraId, exp } };
}

/** Header name for download token (preferred over query string — avoids logs/Referer leaks). */
export const ACREDITARE_PDF_TOKEN_HEADER = "x-acreditare-download-token";

/** Extract download token from header, Authorization scheme, or legacy query param. */
export function extractAcreditarePdfDownloadToken(req: Request, url?: URL): string {
  const fromHeader = String(req.headers.get(ACREDITARE_PDF_TOKEN_HEADER) || "").trim();
  if (fromHeader) return fromHeader;

  const auth = String(req.headers.get("authorization") || "").trim();
  const m = auth.match(/^AcreditarePdf\s+(\S+)/i);
  if (m?.[1]) return m[1].trim();

  // Legacy: token in query (old email links). Prefer hash landing page for new links.
  const u = url || new URL(req.url);
  return String(u.searchParams.get("token") || "").trim();
}

/**
 * Public download link for journalist email.
 * Token goes in the URL hash (not query) so it is not sent to the server / Referer / access logs.
 * The landing page fetches the PDF with X-Acreditare-Download-Token.
 */
export function buildPublicAcreditarePdfUrl(args: {
  origin: string;
  acreditareId: string;
  judetId: string;
  structuraId: string;
  ttlSeconds?: number;
}): string {
  const token = createAcreditarePdfToken({
    acreditareId: args.acreditareId,
    judetId: args.judetId,
    structuraId: args.structuraId,
    ttlSeconds: args.ttlSeconds,
  });
  const qs = new URLSearchParams({
    judetId: String(args.judetId || "").toUpperCase(),
    structuraId: String(args.structuraId || "").toUpperCase(),
  });
  const id = encodeURIComponent(String(args.acreditareId || "").trim());
  return `${args.origin}/acreditare/descarca/${id}?${qs.toString()}#t=${encodeURIComponent(token)}`;
}
