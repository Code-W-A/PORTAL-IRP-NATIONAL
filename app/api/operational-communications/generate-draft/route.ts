import { NextResponse } from "next/server";

import { lookupUserFromIdToken, requireBearerToken } from "@/lib/server/auth";
import {
  generateOperationalDraft,
  type OperationalDraftInput,
} from "@/lib/server/openaiOperationalCommunication";

export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonWithCors(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: CORS_HEADERS,
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

type GenerateDraftBody = {
  incident?: OperationalDraftInput & {
    id?: string;
    rawMessages?: OperationalDraftInput["rawMessages"];
  };
  promptConfig?: OperationalDraftInput["promptConfig"];
};

export async function POST(req: Request) {
  const requestId =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any)?.crypto?.randomUUID?.() ||
    `opdraft_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  try {
    const idToken = await requireBearerToken(req);
    await lookupUserFromIdToken(idToken);

    const body = (await req.json()) as GenerateDraftBody;
    const incident = body.incident;
    if (!incident?.rawMessages?.length) {
      return jsonWithCors({ error: "Missing incident.rawMessages", requestId }, { status: 400 });
    }

    const result = await generateOperationalDraft({
      rawMessages: incident.rawMessages,
      extractedData: incident.extractedData || {},
      status: incident.status || "in_progress",
      type: incident.type || "alt_tip",
      location: incident.location || "",
      area: incident.area,
      initialTime: incident.initialTime || "",
      warnings: incident.warnings,
      needsHumanReview: incident.needsHumanReview,
      promptConfig: body.promptConfig,
    });

    return jsonWithCors({ draft: result.draft, model: result.model, requestId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status =
      message === "missing_auth" || message === "invalid_token"
        ? 401
        : message === "Missing OPENAI_API_KEY"
          ? 500
          : 500;
    console.error("[operational-communications/generate-draft]", { requestId, message });
    return jsonWithCors({ error: message, requestId }, { status });
  }
}
