import {
  acreditareMatchesJurnalist,
  parseAcreditareNumar,
  yearFromDateLabel,
  type JurnalistMatchFields,
} from "@/lib/acreditari";
import { createAcreditareLogger } from "@/lib/server/acreditareLogger";
import { getFirebaseAdmin } from "@/lib/server/firebaseAdmin";

export type SameYearAcreditareHit = {
  id: string;
  numar: string;
  data: string;
  year: number;
};

/**
 * Finds an already-issued Acreditari doc for the same journalist + calendar year.
 * Uses Admin SDK (does not require open client rules).
 */
export async function findSameYearIssuedAcreditare(args: {
  judetId: string;
  structuraId: string;
  jurnalist: JurnalistMatchFields;
  year: number;
  excludeAcreditareId?: string;
}): Promise<SameYearAcreditareHit | null> {
  const judetId = String(args.judetId || "").toUpperCase();
  const structuraId = String(args.structuraId || "").toUpperCase();
  const year = args.year;
  if (!judetId || !structuraId || !year) return null;

  const logger = createAcreditareLogger({
    area: "duplicate-guard",
    tenant: { judetId, structuraId },
  });
  try {
    const { db } = getFirebaseAdmin();
    const snap = await db.collection(`Judete/${judetId}/Structuri/${structuraId}/Acreditari`).get();
    const exclude = String(args.excludeAcreditareId || "").trim();

    for (const d of snap.docs) {
      if (exclude && d.id === exclude) continue;
      const data = d.data() as Record<string, any>;
      if (!acreditareMatchesJurnalist(data, args.jurnalist)) continue;
      const y = yearFromDateLabel(String(data?.data || ""));
      if (y === year) {
        logger.info("same_year_hit", {
          year,
          acreditareId: d.id,
          numar: String(data?.numar || "").trim(),
          scanned: snap.size,
        });
        return {
          id: d.id,
          numar: String(data?.numar || "").trim(),
          data: String(data?.data || "").trim(),
          year,
        };
      }
    }
    return null;
  } catch (e: any) {
    logger.error("same_year_scan_failed", {
      year,
      message: String(e?.message || e || "error"),
    });
    throw e;
  }
}

/** Max numeric `numar` across issued Acreditari (floor for allocate). */
export async function maxIssuedAcreditareNumar(args: {
  judetId: string;
  structuraId: string;
}): Promise<number> {
  const judetId = String(args.judetId || "").toUpperCase();
  const structuraId = String(args.structuraId || "").toUpperCase();
  if (!judetId || !structuraId) return 0;

  const { db } = getFirebaseAdmin();
  const snap = await db.collection(`Judete/${judetId}/Structuri/${structuraId}/Acreditari`).get();
  let max = 0;
  for (const d of snap.docs) {
    const n = parseAcreditareNumar((d.data() as any)?.numar);
    if (n != null && n > max) max = n;
  }
  return max;
}

export async function deleteAcreditareDocAdmin(args: {
  judetId: string;
  structuraId: string;
  acreditareId: string;
}): Promise<void> {
  const judetId = String(args.judetId || "").toUpperCase();
  const structuraId = String(args.structuraId || "").toUpperCase();
  const acreditareId = String(args.acreditareId || "").trim();
  if (!judetId || !structuraId || !acreditareId) return;
  const { db } = getFirebaseAdmin();
  await db.doc(`Judete/${judetId}/Structuri/${structuraId}/Acreditari/${acreditareId}`).delete();
}
