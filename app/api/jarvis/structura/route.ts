import { NextResponse } from "next/server";

import { requireBearerToken } from "@/lib/server/auth";
import { getJarvisReaderIdToken, isJarvisMakeRequest, JARVIS_ISU_DB_TENANT } from "@/lib/server/jarvisMakeAuth";
import { buildJarvisStructuraSnapshot } from "@/lib/server/jarvisStructuraSnapshot";
import { getTenantFromIdToken } from "@/lib/settings/getSettings";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
};

function json(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: CORS_HEADERS,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: Request) {
  try {
    const make = isJarvisMakeRequest(req);
    const idToken = make ? await getJarvisReaderIdToken() : await requireBearerToken(req);
    const tenant = await getTenantFromIdToken(idToken);
    if (tenant.judetId !== JARVIS_ISU_DB_TENANT.judetId || tenant.structuraId !== JARVIS_ISU_DB_TENANT.structuraId) {
      return json({ error: "tenant_mismatch", expected: JARVIS_ISU_DB_TENANT }, { status: 403 });
    }

    const payload = await buildJarvisStructuraSnapshot(idToken);

    return json({ ok: true, ...payload });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status =
      message === "missing_auth" ||
      message === "invalid_token" ||
      message === "invalid_api_key" ||
      message === "invalid_reader_credentials"
        ? 401
        : message === "missing_tenant" || message === "tenant_mismatch"
          ? 403
          : message.startsWith("missing_env")
            ? 503
            : 500;
    console.error("[jarvis/structura]", message);
    return json({ error: message }, { status });
  }
}
