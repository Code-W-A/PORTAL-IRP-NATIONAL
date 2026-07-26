import { getFirebaseAdmin } from "@/lib/server/firebaseAdmin";

export type AcreditareSemnatar = { nume?: string; functia?: string; grad?: string };

export type AcreditarePublicSettings = {
  headerLines: string[];
  logoUrlPublic?: string;
  unitLabel?: string;
  city?: string;
  phone?: string;
  footerLines?: any;
  acreditareSemnatarStanga?: AcreditareSemnatar;
  acreditareSemnatarDreapta?: AcreditareSemnatar;
};

export type AcreditareSignatureSecrets = {
  acreditareSemnatarStanga?: AcreditareSemnatar;
  acreditareSemnatarDreapta?: AcreditareSemnatar;
  acreditareSemnatarStangaImg?: string | null;
  acreditareSemnatarDreaptaImg?: string | null;
};

export function acreditareGeneralPath(judetId: string, structuraId: string) {
  return `Judete/${judetId}/Structuri/${structuraId}/Settings/general`;
}

/** Private settings — signature images must not live on Settings/general. */
export function acreditareSecretsPath(judetId: string, structuraId: string) {
  return `Judete/${judetId}/Structuri/${structuraId}/Settings/acreditareSecrets`;
}

function pickPublicSettings(gen: Record<string, any> | null | undefined): AcreditarePublicSettings {
  return {
    headerLines: Array.isArray(gen?.headerLines) ? (gen!.headerLines as string[]) : [],
    logoUrlPublic: gen?.logoUrlPublic ? String(gen.logoUrlPublic) : undefined,
    unitLabel: gen?.unitLabel,
    city: gen?.city,
    phone: gen?.phone,
    footerLines: gen?.footerLines || [],
    acreditareSemnatarStanga: gen?.acreditareSemnatarStanga,
    acreditareSemnatarDreapta: gen?.acreditareSemnatarDreapta,
  };
}

/**
 * Public PDF data via Admin SDK — does not depend on open client Firestore rules.
 * Requires judetId + structuraId (email links already include them).
 * Never returns signature image fields.
 */
export async function loadAcreditarePublicPdfBundle(args: {
  acreditareId: string;
  judetId?: string | null;
  structuraId?: string | null;
}): Promise<{
  acreditare: Record<string, any>;
  judetId: string;
  structuraId: string;
  settings: AcreditarePublicSettings;
} | null> {
  const judetId = String(args.judetId || "").toUpperCase();
  const structuraId = String(args.structuraId || "").toUpperCase();
  const acreditareId = String(args.acreditareId || "").trim();
  if (!judetId || !structuraId || !acreditareId) {
    throw new Error("missing_tenant_query");
  }

  const { db } = getFirebaseAdmin();
  const acrSnap = await db.doc(`Judete/${judetId}/Structuri/${structuraId}/Acreditari/${acreditareId}`).get();
  if (!acrSnap.exists) return null;

  const genSnap = await db.doc(acreditareGeneralPath(judetId, structuraId)).get();
  const gen = genSnap.exists ? (genSnap.data() as Record<string, any>) : null;
  const publicSettings = pickPublicSettings(gen);
  // Semnatar text lives in acreditareSecrets (secret-settings); never embed signature images here.
  const secrets = await loadAcreditareSignatureSettings(judetId, structuraId);

  return {
    acreditare: (acrSnap.data() || {}) as Record<string, any>,
    judetId,
    structuraId,
    settings: {
      ...publicSettings,
      acreditareSemnatarStanga: secrets.acreditareSemnatarStanga ?? publicSettings.acreditareSemnatarStanga,
      acreditareSemnatarDreapta: secrets.acreditareSemnatarDreapta ?? publicSettings.acreditareSemnatarDreapta,
    },
  };
}

/**
 * Signature labels/images: prefer Settings/acreditareSecrets, fall back to legacy
 * fields on Settings/general (pre-migration).
 */
export async function loadAcreditareSignatureSettings(
  judetId: string,
  structuraId: string
): Promise<AcreditareSignatureSecrets> {
  const j = String(judetId || "").toUpperCase();
  const s = String(structuraId || "").toUpperCase();
  const { db } = getFirebaseAdmin();

  const [secretsSnap, generalSnap] = await Promise.all([
    db.doc(acreditareSecretsPath(j, s)).get(),
    db.doc(acreditareGeneralPath(j, s)).get(),
  ]);
  const secrets = secretsSnap.exists ? (secretsSnap.data() as Record<string, any>) : null;
  const general = generalSnap.exists ? (generalSnap.data() as Record<string, any>) : null;

  return {
    acreditareSemnatarStanga: secrets?.acreditareSemnatarStanga ?? general?.acreditareSemnatarStanga,
    acreditareSemnatarDreapta: secrets?.acreditareSemnatarDreapta ?? general?.acreditareSemnatarDreapta,
    acreditareSemnatarStangaImg:
      secrets?.acreditareSemnatarStangaImg ?? general?.acreditareSemnatarStangaImg ?? null,
    acreditareSemnatarDreaptaImg:
      secrets?.acreditareSemnatarDreaptaImg ?? general?.acreditareSemnatarDreaptaImg ?? null,
  };
}

/** Persist signatures on the private doc and clear images from Settings/general. */
export async function saveAcreditareSignatureSettings(
  judetId: string,
  structuraId: string,
  payload: AcreditareSignatureSecrets
): Promise<void> {
  const j = String(judetId || "").toUpperCase();
  const s = String(structuraId || "").toUpperCase();
  const { db } = getFirebaseAdmin();
  const now = new Date().toISOString();

  await db.doc(acreditareSecretsPath(j, s)).set(
    {
      acreditareSemnatarStanga: payload.acreditareSemnatarStanga || {},
      acreditareSemnatarDreapta: payload.acreditareSemnatarDreapta || {},
      acreditareSemnatarStangaImg: payload.acreditareSemnatarStangaImg ?? null,
      acreditareSemnatarDreaptaImg: payload.acreditareSemnatarDreaptaImg ?? null,
      updatedAt: now,
    },
    { merge: true }
  );

  // Stop co-locating signature images with publicly used letterhead settings.
  await db.doc(acreditareGeneralPath(j, s)).set(
    {
      acreditareSemnatarStangaImg: null,
      acreditareSemnatarDreaptaImg: null,
      updatedAt: now,
    },
    { merge: true }
  );
}
