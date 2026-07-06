import { NextResponse } from "next/server";

import { lookupUserFromIdToken, requireBearerToken } from "@/lib/server/auth";
import { getFirebaseAdmin } from "@/lib/server/firebaseAdmin";
import { syncGoogleCalendarToFirestore, validateGoogleIcalUrl } from "@/lib/server/googleCalendarSync";

export const runtime = "nodejs";

type SyncBody = {
  judetId?: string;
  structuraId?: string;
  googleIcalUrl?: string;
};

function settingsPath(judetId: string, structuraId: string) {
  return `Judete/${judetId}/Structuri/${structuraId}/Settings/calendarSync`;
}

export async function POST(req: Request) {
  const requestId =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any)?.crypto?.randomUUID?.() ||
    `gcal_sync_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  try {
    const idToken = await requireBearerToken(req);
    const user = await lookupUserFromIdToken(idToken);
    const body = (await req.json()) as SyncBody;

    const judetId = String(body.judetId || "DB").trim();
    const structuraId = String(body.structuraId || "ISU").trim();
    const scope = {
      judetId,
      structuraId,
      workspaceId: `${judetId}/${structuraId}`,
    };

    const { db } = getFirebaseAdmin();
    const settingsRef = db.doc(settingsPath(judetId, structuraId));
    const settingsSnap = await settingsRef.get();
    const settings = settingsSnap.data() || {};

    const icalUrl = String(body.googleIcalUrl || settings.googleIcalUrl || "").trim();
    if (!icalUrl) {
      return NextResponse.json(
        { error: "missing_google_ical_url", requestId },
        { status: 400 }
      );
    }

    validateGoogleIcalUrl(icalUrl);

    const result = await syncGoogleCalendarToFirestore({
      db,
      scope,
      icalUrl,
      userId: user.uid,
    });

    const nowIso = new Date().toISOString();
    const message = `Sync OK: ${result.created} noi, ${result.updated} actualizate, ${result.removed} eliminate din Google.`;
    await settingsRef.set(
      {
        googleIcalUrl: icalUrl,
        syncEnabled: settings.syncEnabled ?? true,
        syncIntervalMinutes: settings.syncIntervalMinutes ?? 30,
        lastSyncAt: nowIso,
        lastSyncStatus: "ok",
        lastSyncMessage: message,
        lastSyncStats: {
          created: result.created,
          updated: result.updated,
          removed: result.removed,
          skipped: result.skipped,
          errors: result.errors,
        },
        updatedAt: nowIso,
        updatedBy: user.uid,
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, result, message, requestId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status =
      message === "missing_auth" || message === "invalid_token"
        ? 401
        : message.startsWith("missing_env:")
          ? 500
          : 400;

    console.error("[calendar-activitati/sync-google]", { requestId, message });
    return NextResponse.json({ error: message, requestId }, { status });
  }
}
