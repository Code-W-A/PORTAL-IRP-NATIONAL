import { NextResponse } from "next/server";

import { getBearerToken } from "@/lib/server/auth";
import { getFirebaseAdmin } from "@/lib/server/firebaseAdmin";

export const runtime = "nodejs";

type ChangePasswordPayload = {
  targetEmail?: string;
  newPassword?: string;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function mapAdminAuthError(error: any) {
  const code = String(error?.code || "");

  if (code === "auth/user-not-found") {
    return { message: "Nu există niciun cont cu acest email.", status: 404 };
  }

  if (code === "auth/invalid-password" || code === "auth/weak-password") {
    return { message: "Parola nouă este prea slabă. Folosește minimum 6 caractere.", status: 400 };
  }

  if (code === "auth/invalid-email") {
    return { message: "Emailul contului țintă nu este valid.", status: 400 };
  }

  return { message: "Nu am putut schimba parola contului.", status: 500 };
}

async function assertApplicationAdmin(idToken: string) {
  const { auth, db } = getFirebaseAdmin();
  const decoded = await auth.verifyIdToken(idToken);

  const profileSnap = await db.doc(`users/${decoded.uid}`).get();
  const profile = profileSnap.exists ? profileSnap.data() : null;
  const judetId = String(profile?.judetId || "").toUpperCase();
  const structuraId = String(profile?.structuraId || "").toUpperCase();

  if (judetId !== "DB" || structuraId !== "ISU") {
    throw new Error("forbidden");
  }

  const structuraSnap = await db.doc("Judete/DB/Structuri/ISU").get();
  const structura = structuraSnap.exists ? structuraSnap.data() : null;
  if (structura?.isAdmin !== true) {
    throw new Error("forbidden");
  }

  return {
    uid: decoded.uid,
    email: decoded.email || null,
  };
}

export async function POST(req: Request) {
  try {
    const idToken = getBearerToken(req);
    if (!idToken) return jsonError("Trebuie să fii autentificat.", 401);

    const body = (await req.json().catch(() => null)) as ChangePasswordPayload | null;
    const targetEmail = String(body?.targetEmail || "").trim().toLowerCase();
    const newPassword = String(body?.newPassword || "");

    if (!targetEmail) return jsonError("Completează emailul contului țintă.", 400);
    if (!newPassword || newPassword.length < 6) {
      return jsonError("Parola nouă trebuie să aibă minimum 6 caractere.", 400);
    }

    const caller = await assertApplicationAdmin(idToken);
    const { auth, db } = getFirebaseAdmin();
    const targetUser = await auth.getUserByEmail(targetEmail);

    await auth.updateUser(targetUser.uid, { password: newPassword });

    try {
      await db.collection("AdminIrpAudit").add({
        action: "change_password",
        actorUid: caller.uid,
        actorEmail: caller.email,
        targetUid: targetUser.uid,
        targetEmail,
        createdAt: new Date().toISOString(),
      });
    } catch {
      // Password reset already succeeded; audit failure should not report the operation as failed.
    }

    return NextResponse.json({
      ok: true,
      message: `Parola pentru ${targetEmail} a fost actualizată.`,
    });
  } catch (error: any) {
    if (error?.message === "forbidden") {
      return jsonError("Nu ai drepturi pentru această operațiune.", 403);
    }

    if (String(error?.code || "") === "auth/id-token-expired") {
      return jsonError("Sesiunea a expirat. Autentifică-te din nou.", 401);
    }

    if (String(error?.message || "").startsWith("missing_env:")) {
      return jsonError("Configurarea Firebase Admin lipsește pe server.", 500);
    }

    const mapped = mapAdminAuthError(error);
    return jsonError(mapped.message, mapped.status);
  }
}
