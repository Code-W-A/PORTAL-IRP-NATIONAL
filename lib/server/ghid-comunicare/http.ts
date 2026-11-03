import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/server/auth";
import { getFirebaseAdmin } from "@/lib/server/firebaseAdmin";
import { GuideError } from "@/lib/ghid-comunicare/validation";
import type { GuideAuthor } from "@/lib/ghid-comunicare/types";
import { GuideService } from "./service";

async function authenticate(req: Request): Promise<GuideAuthor> {
  const token = getBearerToken(req);
  if (!token) throw new GuideError(401, "Autentifică-te pentru a accesa ghidul.");
  const { auth, db } = getFirebaseAdmin();
  let decoded;
  try { decoded = await auth.verifyIdToken(token, true); }
  catch { throw new GuideError(401, "Sesiunea a expirat. Autentifică-te din nou."); }
  const profile = (await db.doc(`users/${decoded.uid}`).get()).data();
  if (!profile?.judetId || !profile?.structuraId) throw new GuideError(403, "Contul nu are un profil IRP complet.");
  let name = typeof decoded.name === "string" ? decoded.name.trim() : "";
  if (!name) {
    // The existing portal uses accounts representing a structure, without a person's name.
    const judetId = String(profile.judetId);
    const structuraId = String(profile.structuraId);
    if ([judetId, structuraId].some(value => !/^[a-zA-Z0-9_-]+$/.test(value))) throw new GuideError(403, "Profil IRP invalid.");
    const settings = (await db.doc(`Judete/${judetId}/Structuri/${structuraId}/Settings/general`).get()).data();
    name = String(settings?.structureDisplay || settings?.unitLabel || `${structuraId} ${judetId}`).trim();
  }
  return { uid: decoded.uid, name: name.slice(0, 300) };
}
export async function readBody(req: Request) {
  const text = await req.text();
  if (Buffer.byteLength(text) > 500000) throw new GuideError(413, "Conținutul este prea lung.");
  try { return JSON.parse(text); }
  catch { throw new GuideError(400, "Datele trimise nu sunt valide."); }
}
export async function guideRequest(req: Request, action: (service: GuideService, actor: GuideAuthor) => Promise<unknown>) {
  try {
    const actor = await authenticate(req);
    const result = await action(new GuideService(getFirebaseAdmin().db), actor);
    return NextResponse.json(result ?? { ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const known = error instanceof GuideError;
    if (!known) console.error("[ghid-comunicare]", error instanceof Error ? error.name : "unknown_error");
    return NextResponse.json({ error: known ? error.message : "Nu am putut finaliza operațiunea. Încearcă din nou." },
      { status: known ? error.status : 500, headers: { "Cache-Control": "private, no-store" } });
  }
}
