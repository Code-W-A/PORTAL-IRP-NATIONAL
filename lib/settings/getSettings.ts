import { lookupUserFromIdToken } from "@/lib/server/auth";
import { firestoreGetDocAsJson } from "@/lib/server/firestoreRest";

export type StructuraSettings = {
  headerLines?: string[];
  logoUrlPublic?: string;
  assetBaseUrl?: string;
  secrecyLabel?: string;
  city?: string;
  email?: string;
  phone?: string;
  footerLines?: string[];
  unitLabel?: string;
  pdfTemplateKey?: string;
  semnatari?: { functia: string; grad: string; nume: string }[];
  semnatarIndex?: number;
  purtatori?: { nume: string }[];
  purtatorIndex?: number;
};

export type TenantInfo = {
  uid: string;
  email?: string | null;
  judetId: string;
  structuraId: string;
};

export type StructuraDoc = {
  isAdmin?: boolean;
};

export async function getTenantFromIdToken(idToken: string): Promise<TenantInfo> {
  const authUser = await lookupUserFromIdToken(idToken);
  const profile = await firestoreGetDocAsJson<{ judetId?: string; structuraId?: string }>(`users/${authUser.uid}`, idToken);
  const judetId = String(profile?.judetId || "").toUpperCase();
  const structuraId = String(profile?.structuraId || "").toUpperCase();
  if (!judetId || !structuraId) {
    throw new Error("missing_tenant");
  }
  return { uid: authUser.uid, email: authUser.email, judetId, structuraId };
}

export async function getStructuraSettings(idToken: string, origin: string) {
  const tenant = await getTenantFromIdToken(idToken);
  const settings = await firestoreGetDocAsJson<StructuraSettings>(
    `Judete/${tenant.judetId}/Structuri/${tenant.structuraId}/Settings/general`,
    idToken
  );
  const structura = await firestoreGetDocAsJson<StructuraDoc>(
    `Judete/${tenant.judetId}/Structuri/${tenant.structuraId}`,
    idToken
  );

  let logoUrlPublic = settings?.logoUrlPublic;
  if (logoUrlPublic) {
    try {
      logoUrlPublic = new URL(String(logoUrlPublic), origin).toString();
    } catch {}
  }

  return {
    tenant,
    settings: settings ? { ...settings, logoUrlPublic, assetBaseUrl: origin } : null,
    structura,
  };
}
