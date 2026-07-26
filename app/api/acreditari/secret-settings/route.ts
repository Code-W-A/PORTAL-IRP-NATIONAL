import { NextResponse } from "next/server";

import { lookupUserFromIdToken, requireBearerToken } from "@/lib/server/auth";
import {
  loadAcreditareSignatureSettings,
  saveAcreditareSignatureSettings,
  type AcreditareSemnatar,
} from "@/lib/server/acreditarePdfSettings";
import {
  createAcreditareLogger,
  errorLogFields,
  newAcreditareRequestId,
} from "@/lib/server/acreditareLogger";
import { firestoreGetDocAsJson } from "@/lib/server/firestoreRest";
import { getStructuraSettings } from "@/lib/settings/getSettings";

export const runtime = "nodejs";

type SecretSettingsPayload = {
  acreditareSemnatarStanga?: AcreditareSemnatar | null;
  acreditareSemnatarDreapta?: AcreditareSemnatar | null;
  acreditareSemnatarStangaImg?: string | null;
  acreditareSemnatarDreaptaImg?: string | null;
};

function normalizeSemnatar(v: unknown): AcreditareSemnatar {
  if (!v || typeof v !== "object") return {};
  const o = v as Record<string, unknown>;
  return {
    nume: typeof o.nume === "string" ? o.nume : undefined,
    functia: typeof o.functia === "string" ? o.functia : undefined,
    grad: typeof o.grad === "string" ? o.grad : undefined,
  };
}

function normalizeImg(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s || null;
}

async function requireAdmin(idToken: string, origin: string) {
  const { tenant, structura } = await getStructuraSettings(idToken, origin);
  if (!structura?.isAdmin) {
    throw new Error("forbidden_admin");
  }
  return tenant;
}

async function requireAdminOwner(idToken: string, origin: string) {
  const tenant = await requireAdmin(idToken, origin);
  const owner = await firestoreGetDocAsJson<{ uid?: string }>(
    `Judete/${tenant.judetId}/Structuri/${tenant.structuraId}/Settings/owner`,
    idToken
  );
  if (!owner?.uid || owner.uid !== tenant.uid) {
    throw new Error("forbidden_owner");
  }
  return tenant;
}

export async function GET(req: Request) {
  const requestId = newAcreditareRequestId("acr_secrets_get");
  let logger = createAcreditareLogger({ area: "secret-settings", requestId });
  try {
    logger.info("start", { method: "GET" });
    const idToken = await requireBearerToken(req);
    const origin = new URL(req.url).origin;
    const tenant = await requireAdmin(idToken, origin);
    logger = createAcreditareLogger({
      area: "secret-settings",
      requestId,
      tenant: { judetId: tenant.judetId, structuraId: tenant.structuraId, uid: tenant.uid },
    });
    const secrets = await loadAcreditareSignatureSettings(tenant.judetId, tenant.structuraId);
    logger.info("ok", {
      hasLeftImg: Boolean(normalizeImg(secrets.acreditareSemnatarStangaImg)),
      hasRightImg: Boolean(normalizeImg(secrets.acreditareSemnatarDreaptaImg)),
    });

    return NextResponse.json({
      requestId,
      acreditareSemnatarStanga: normalizeSemnatar(secrets.acreditareSemnatarStanga),
      acreditareSemnatarDreapta: normalizeSemnatar(secrets.acreditareSemnatarDreapta),
      acreditareSemnatarStangaImg: normalizeImg(secrets.acreditareSemnatarStangaImg),
      acreditareSemnatarDreaptaImg: normalizeImg(secrets.acreditareSemnatarDreaptaImg),
    });
  } catch (error: any) {
    logger.error("failed", { ...errorLogFields(error), method: "GET" });
    if (error?.message === "missing_auth") {
      return NextResponse.json({ error: "Unauthorized", requestId }, { status: 401 });
    }
    if (error?.message === "missing_tenant") {
      return NextResponse.json({ error: "Profil incomplet (judetId/structuraId).", requestId }, { status: 403 });
    }
    if (error?.message === "forbidden_admin") {
      return NextResponse.json({ error: "Forbidden", requestId }, { status: 403 });
    }
    return NextResponse.json({ error: "Server error", requestId }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const requestId = newAcreditareRequestId("acr_secrets_patch");
  let logger = createAcreditareLogger({ area: "secret-settings", requestId });
  try {
    logger.info("start", { method: "PATCH" });
    const idToken = await requireBearerToken(req);
    await lookupUserFromIdToken(idToken);
    const origin = new URL(req.url).origin;
    const tenant = await requireAdminOwner(idToken, origin);
    logger = createAcreditareLogger({
      area: "secret-settings",
      requestId,
      tenant: { judetId: tenant.judetId, structuraId: tenant.structuraId, uid: tenant.uid },
    });
    const body = (await req.json().catch(() => ({}))) as SecretSettingsPayload;

    await saveAcreditareSignatureSettings(tenant.judetId, tenant.structuraId, {
      acreditareSemnatarStanga: normalizeSemnatar(body.acreditareSemnatarStanga),
      acreditareSemnatarDreapta: normalizeSemnatar(body.acreditareSemnatarDreapta),
      acreditareSemnatarStangaImg: normalizeImg(body.acreditareSemnatarStangaImg),
      acreditareSemnatarDreaptaImg: normalizeImg(body.acreditareSemnatarDreaptaImg),
    });
    logger.info("ok", {
      method: "PATCH",
      hasLeftImg: Boolean(normalizeImg(body.acreditareSemnatarStangaImg)),
      hasRightImg: Boolean(normalizeImg(body.acreditareSemnatarDreaptaImg)),
    });
    return NextResponse.json({ ok: true, requestId });
  } catch (error: any) {
    logger.error("failed", { ...errorLogFields(error), method: "PATCH" });
    if (error?.message === "missing_auth") {
      return NextResponse.json({ error: "Unauthorized", requestId }, { status: 401 });
    }
    if (error?.message === "missing_tenant") {
      return NextResponse.json({ error: "Profil incomplet (judetId/structuraId).", requestId }, { status: 403 });
    }
    if (error?.message === "forbidden_admin" || error?.message === "forbidden_owner") {
      return NextResponse.json(
        { error: "Forbidden: doar owner-ul structurii poate salva setările.", requestId },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: "Server error", requestId }, { status: 500 });
  }
}
