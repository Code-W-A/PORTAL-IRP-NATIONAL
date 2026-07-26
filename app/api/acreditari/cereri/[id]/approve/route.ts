import { NextResponse } from "next/server";
import React from "react";

import { requireBearerToken, lookupUserFromIdToken } from "@/lib/server/auth";
import {
  firestoreAllocateNextAcreditareNumar,
  firestoreCreateDoc,
  firestoreGetDocAsJson,
  firestorePatchDoc,
} from "@/lib/server/firestoreRest";
import {
  buildStructuraKey,
  resolveJurnalistDocIdFromCerereAsync,
  acreditareDocIdForCerere,
  resolveAcreditareIdForStructura,
  cerereHasJurnalistIdentity,
  yearFromDateLabel,
  mergeLastAcreditareFields,
  isJurnalistAccreditedForYear,
  parseAcreditareNumar,
  type CerereAcreditare,
} from "@/lib/acreditari";
import {
  deleteAcreditareDocAdmin,
  findSameYearIssuedAcreditare,
  maxIssuedAcreditareNumar,
} from "@/lib/server/acreditareDuplicateGuard";
import { buildPublicAcreditarePdfUrl } from "@/lib/server/acreditarePdfToken";
import {
  createAcreditareLogger,
  errorLogFields,
  newAcreditareRequestId,
} from "@/lib/server/acreditareLogger";
import { sendMailGmailSmtp } from "@/lib/server/smtp";
export const runtime = "nodejs";

function ddmmyyyy(d = new Date()) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = String(d.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}


function safeFileName(name: string): string {
  return String(name || "acreditare")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 80);
}

function buildCerereSourcePatch(cerere: any, acreditareId: string) {
  const existingSource = cerere?.source && typeof cerere.source === "object" ? cerere.source : {};
  const source = { ...existingSource };
  const structuraKeys = Array.isArray(cerere?.structuraKeys) ? cerere.structuraKeys : [];
  if (structuraKeys.length <= 1) {
    source.acreditareId = acreditareId;
  }
  return source;
}

async function finalizeCerereApproval(args: {
  cerereId: string;
  idToken: string;
  cerere: any;
  statusByStructura: Record<string, any>;
  currentKey: string;
  currentStatus: Record<string, any>;
  nowIso: string;
  authUser: { uid: string; email?: string | null };
  acreditareId: string;
  numar: string;
  acrData: string;
}) {
  const {
    cerereId,
    idToken,
    cerere,
    statusByStructura,
    currentKey,
    currentStatus,
    nowIso,
    authUser,
    acreditareId,
    numar,
    acrData,
  } = args;

  statusByStructura[currentKey] = {
    ...currentStatus,
    status: "approved",
    decidedAt: { __timestamp: nowIso },
    decidedByUid: authUser.uid,
    decidedByEmail: authUser.email || null,
    acreditareId,
    acreditareNumar: numar,
    acreditareData: acrData,
  };

  const patch: Record<string, any> = {
    source: buildCerereSourcePatch(cerere, acreditareId),
    statusByStructura,
    updatedAt: { __timestamp: nowIso },
  };
  // Keep global cerere.acreditare only for single-structura (legacy readers).
  // Multi-structura must not overwrite a shared global number from another tenant.
  const structuraKeys = Array.isArray(cerere?.structuraKeys) ? cerere.structuraKeys : [];
  if (structuraKeys.length <= 1) {
    patch.acreditare = { numar, data: acrData };
  }

  await firestorePatchDoc(`CereriAcreditare/${cerereId}`, idToken, patch);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newAcreditareRequestId("acr_approve");
  let logger = createAcreditareLogger({ area: "approve", requestId });
  const log = (action: string, meta?: Record<string, unknown>) => logger.info(action, meta);
  const logErr = (action: string, meta?: Record<string, unknown>) => logger.error(action, meta);
  try {
    const { id } = await ctx.params;
    log("start", { cerereId: id });
    const idToken = await requireBearerToken(req);
    const authUser = await lookupUserFromIdToken(idToken);
    const body = await req.json().catch(() => ({} as any));
    const numarOverride = typeof body?.numar === "string" ? body.numar.trim() : "";
    const dataOverride = typeof body?.data === "string" ? body.data.trim() : "";
    const allowSameYearDuplicate = body?.allowSameYearDuplicate === true;

    // Resolve tenant from user profile
    const profile = await firestoreGetDocAsJson<{ judetId?: string; structuraId?: string }>(`users/${authUser.uid}`, idToken);
    const judetId = String(profile?.judetId || "").toUpperCase();
    const structuraId = String(profile?.structuraId || "").toUpperCase();
    if (!judetId || !structuraId) {
      log("forbidden_incomplete_profile");
      return NextResponse.json({ error: "Profil incomplet (judetId/structuraId).", requestId }, { status: 403 });
    }
    logger = createAcreditareLogger({
      area: "approve",
      requestId,
      tenant: { judetId, structuraId, uid: authUser.uid },
    });
    log("tenant", { email: authUser.email || null, allowSameYearDuplicate });

    // Ensure caller is owner for that structura (Settings/owner.uid === caller uid)
    const owner = await firestoreGetDocAsJson<{ uid?: string }>(`Judete/${judetId}/Structuri/${structuraId}/Settings/owner`, idToken);
    if (!owner?.uid || owner.uid !== authUser.uid) {
      return NextResponse.json({ error: "Forbidden: nu ești owner pentru această structură." }, { status: 403 });
    }

    const currentKey = buildStructuraKey(judetId, structuraId);
    const cerere = await firestoreGetDocAsJson<CerereAcreditare>(`CereriAcreditare/${id}`, idToken);
    if (!cerere) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!Array.isArray((cerere as any).structuraKeys) || !(cerere as any).structuraKeys.includes(currentKey)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const statusByStructura = { ...((cerere as any).statusByStructura || {}) };
    const currentStatus = { ...(statusByStructura[currentKey] || {}) };
    const existingStatus = String(currentStatus.status || "pending");
    const jurnalist = (cerere as any).jurnalist || {};
    const media = (cerere as any).media || {};
    const to = String(jurnalist?.email || "").trim();

    if (existingStatus === "rejected") {
      return NextResponse.json({ error: "Cererea a fost deja respinsă.", requestId }, { status: 409 });
    }

    if (existingStatus === "approved") {
      const acrBasePath = `Judete/${judetId}/Structuri/${structuraId}/Acreditari`;
      const resolvedId = resolveAcreditareIdForStructura(cerere, currentKey, id);
      const existingAcr = await firestoreGetDocAsJson<any>(`${acrBasePath}/${resolvedId}`, idToken);
      if (existingAcr) {
        log("already_approved", { acreditareId: resolvedId });
        return NextResponse.json({
          ok: true,
          acreditareId: resolvedId,
          alreadyApproved: true,
          requestId,
          email: {
            to: to || null,
            sent: false,
            attachPdf: false,
            skipReason: "already_approved",
          },
        });
      }

      return NextResponse.json(
        { error: "Cererea este deja aprobată, dar acreditarea emisă nu a fost găsită.", requestId },
        { status: 409 }
      );
    }

    if (!cerereHasJurnalistIdentity(cerere as CerereAcreditare)) {
      return NextResponse.json(
        { error: "Cererea nu conține date suficiente pentru identificarea jurnalistului.", requestId },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const nrLegit = String(jurnalist?.legitimatie?.numar || "").trim();
    const numeIn = String(jurnalist?.numePrenume || "").trim();
    const emailIn = String(jurnalist?.email || "").trim();
    const telefonIn = String(jurnalist?.telefon?.mobil || jurnalist?.telefon?.fix || "").trim();
    const redactieIn = String(media?.denumire || "").trim();
    const cerereNumar = String((cerere as any)?.acreditare?.numar || "").trim();
    const cerereData = String((cerere as any)?.acreditare?.data || "").trim();
    const acrData = dataOverride || cerereData || ddmmyyyy(new Date());
    const structuraKeys = Array.isArray((cerere as any).structuraKeys) ? (cerere as any).structuraKeys : [];
    const isMultiStructura = structuraKeys.length > 1;
    const accreditationYear = yearFromDateLabel(acrData) || new Date().getFullYear();
    const acreditareDocId = acreditareDocIdForCerere(id, currentKey);

    // Resolve jurnalist before allocating a number — so a rejected duplicate does not burn the series.
    const jId = await resolveJurnalistDocIdFromCerereAsync(
      cerere as CerereAcreditare,
      id,
      async (docId) =>
        firestoreGetDocAsJson<any>(`Judete/${judetId}/Structuri/${structuraId}/Jurnalisti/${docId}`, idToken)
    );
    const jurnalistPath = `Judete/${judetId}/Structuri/${structuraId}/Jurnalisti/${jId}`;
    const existingJ = await firestoreGetDocAsJson<any>(jurnalistPath, idToken);
    const matchJurnalist = {
      nume: numeIn || String(existingJ?.nume || ""),
      email: emailIn || String(existingJ?.email || ""),
      telefon: telefonIn || String(existingJ?.telefon || ""),
      legit: nrLegit || String(existingJ?.legit || ""),
      redactie: redactieIn || String(existingJ?.redactie || ""),
    };

    const acrCollectionPath = `Judete/${judetId}/Structuri/${structuraId}/Acreditari`;
    const sex = String((cerere as any)?.jurnalist?.sex || "").toUpperCase();

    const upsertJurnalistAfterIssue = async (issued: { numar: string; data: string }) => {
      const issuedYear = yearFromDateLabel(issued.data) || accreditationYear;
      const freshJ = await firestoreGetDocAsJson<any>(jurnalistPath, idToken).catch(() => null);
      const lastAcr = mergeLastAcreditareFields(freshJ, issuedYear, issued.numar);
      // Never wipe existing registry contacts with empty cerere fields.
      if (freshJ) {
        const jurnalistPatch: Record<string, any> = {
          lastAcreditareYear: lastAcr.lastAcreditareYear,
          lastAcreditareNumar: lastAcr.lastAcreditareNumar,
          updatedAt: { __timestamp: nowIso },
        };
        if (numeIn) jurnalistPatch.nume = numeIn;
        if (emailIn) jurnalistPatch.email = emailIn;
        if (telefonIn) jurnalistPatch.telefon = telefonIn;
        if (nrLegit) jurnalistPatch.legit = nrLegit;
        if (redactieIn) jurnalistPatch.redactie = redactieIn;
        await firestorePatchDoc(jurnalistPath, idToken, jurnalistPatch);
      } else {
        await firestoreCreateDoc(
          `Judete/${judetId}/Structuri/${structuraId}/Jurnalisti`,
          idToken,
          {
            nume: numeIn,
            email: emailIn,
            telefon: telefonIn,
            legit: nrLegit,
            redactie: redactieIn,
            lastAcreditareYear: lastAcr.lastAcreditareYear,
            lastAcreditareNumar: lastAcr.lastAcreditareNumar,
            createdAt: { __timestamp: nowIso },
            updatedAt: { __timestamp: nowIso },
          },
          jId
        );
      }
    };

    // Recovery first: reuse existing Acreditari/{deterministicId} numar/data — never allocate N+1 on retry.
    const existingByDeterministicId = await firestoreGetDocAsJson<any>(
      `${acrCollectionPath}/${acreditareDocId}`,
      idToken
    );
    if (existingByDeterministicId) {
      const recoverNumar =
        String(existingByDeterministicId.numar || "").trim() ||
        numarOverride ||
        (!isMultiStructura ? cerereNumar : "") ||
        `ACR-${accreditationYear}-${id.slice(0, 6).toUpperCase()}`;
      const recoverData = String(existingByDeterministicId.data || "").trim() || acrData;
      log("acreditare_exists", { acreditareId: acreditareDocId, numar: recoverNumar, data: recoverData });
      try {
        await upsertJurnalistAfterIssue({ numar: recoverNumar, data: recoverData });
      } catch (e: any) {
        logErr("jurnalist_upsert_failed", { message: String(e?.message || e || "error") });
      }
      try {
        await finalizeCerereApproval({
          cerereId: id,
          idToken,
          cerere,
          statusByStructura,
          currentKey,
          currentStatus,
          nowIso,
          authUser,
          acreditareId: acreditareDocId,
          numar: recoverNumar,
          acrData: recoverData,
        });
        log("cerere->approved", { acreditareId: acreditareDocId, recovery: "existing_acreditare" });
      } catch (e: any) {
        logErr("cerere_finalize_failed", { message: String(e?.message || e || "error") });
      }
      return NextResponse.json({
        ok: true,
        acreditareId: acreditareDocId,
        alreadyApproved: true,
        requestId,
        email: {
          to: to || null,
          sent: false,
          attachPdf: false,
          skipReason: "already_approved",
        },
      });
    }

    // Same-year duplicate guard (this cerere's own doc already handled above).
    if (!allowSameYearDuplicate) {
      let sameYearHit: { id: string; numar: string; data: string; year: number } | null = null;
      try {
        sameYearHit = await findSameYearIssuedAcreditare({
          judetId,
          structuraId,
          jurnalist: matchJurnalist,
          year: accreditationYear,
          excludeAcreditareId: acreditareDocId,
        });
        // Trust scan result: do not fall back to registry when scan finds nothing.
        // A prior failed approve may have set lastAcreditareYear without an Acreditari doc.
      } catch (e) {
        log("same_year_scan_failed", errorLogFields(e));
        // Fallback to registry only when Acreditari scan itself failed.
        if (isJurnalistAccreditedForYear(existingJ?.lastAcreditareYear, accreditationYear)) {
          sameYearHit = {
            id: "",
            numar: String(existingJ?.lastAcreditareNumar || "").trim(),
            data: "",
            year: accreditationYear,
          };
        }
      }
      if (sameYearHit) {
        log("same_year_duplicate", { jurnalistId: jId, year: accreditationYear, hit: sameYearHit });
        return NextResponse.json(
          {
            error: `Jurnalistul are deja o acreditare emisă în ${accreditationYear}${
              sameYearHit.numar ? ` (nr. ${sameYearHit.numar})` : ""
            }. Confirmă explicit dacă vrei o a doua acreditare în același an.`,
            code: "same_year_duplicate",
            year: accreditationYear,
            existingAcreditareId: sameYearHit.id || null,
            existingNumar: sameYearHit.numar || null,
            requestId,
          },
          { status: 409 }
        );
      }
    }

    // Allocate only after confirming no issued doc for this cerere.
    // Floor from max issued numar so Settings counter cannot lag behind Lista.
    let maxFromDocs = 0;
    try {
      maxFromDocs = await maxIssuedAcreditareNumar({ judetId, structuraId });
    } catch (e: any) {
      logErr("max_issued_scan_failed", { message: String(e?.message || e || "error") });
    }

    let numar = numarOverride || "";
    if (!numar) {
      if (!isMultiStructura && cerereNumar) {
        const fromCerere = parseAcreditareNumar(cerereNumar);
        if (fromCerere != null && maxFromDocs > 0 && fromCerere <= maxFromDocs) {
          // Cerere reserved a stale number — allocate fresh above issued max.
          const settingsPath = `Judete/${judetId}/Structuri/${structuraId}/Settings/general`;
          const next = await firestoreAllocateNextAcreditareNumar(settingsPath, idToken, {
            floor: maxFromDocs,
          });
          numar = String(next);
          log("numar_cerere_stale_reallocated", { cerereNumar, numar, maxFromDocs });
        } else {
          numar = cerereNumar;
        }
      } else {
        const settingsPath = `Judete/${judetId}/Structuri/${structuraId}/Settings/general`;
        const next = await firestoreAllocateNextAcreditareNumar(settingsPath, idToken, {
          floor: maxFromDocs,
        });
        numar = String(next);
      }
    }
    if (!numar) {
      numar = `ACR-${accreditationYear}-${id.slice(0, 6).toUpperCase()}`;
    }

    const acrDoc = {
      numar,
      data: acrData,
      dataTimestamp: { __timestamp: nowIso },
      nume: numeIn || String(existingJ?.nume || ""),
      sex: sex === "M" ? "M" : sex === "F" ? "F" : null,
      legit: nrLegit || String(existingJ?.legit || ""),
      redactie: redactieIn || String(existingJ?.redactie || ""),
      email: emailIn || String(existingJ?.email || ""),
      telefon: telefonIn || String(existingJ?.telefon || ""),
      judetId,
      structuraId,
      createdAt: { __timestamp: nowIso },
      updatedAt: { __timestamp: nowIso },
      source: { cerereId: id },
    };

    // Create Acreditari first; mark jurnalist accredited only after the document exists.
    let acreditareId: string;
    try {
      acreditareId = await firestoreCreateDoc(acrCollectionPath, idToken, acrDoc, acreditareDocId);
    } catch (e: any) {
      const raced = await firestoreGetDocAsJson<any>(`${acrCollectionPath}/${acreditareDocId}`, idToken);
      if (raced) {
        const racedNumar = String(raced.numar || "").trim() || numar;
        const racedData = String(raced.data || "").trim() || acrData;
        log("acreditare_race_resolved", {
          acreditareId: acreditareDocId,
          numar: racedNumar,
          data: racedData,
        });
        try {
          await upsertJurnalistAfterIssue({ numar: racedNumar, data: racedData });
        } catch (je: any) {
          logErr("jurnalist_upsert_failed", { message: String(je?.message || je || "error") });
        }
        try {
          await finalizeCerereApproval({
            cerereId: id,
            idToken,
            cerere,
            statusByStructura,
            currentKey,
            currentStatus,
            nowIso,
            authUser,
            acreditareId: acreditareDocId,
            numar: racedNumar,
            acrData: racedData,
          });
          log("cerere->approved", { acreditareId: acreditareDocId, recovery: "create_race" });
        } catch (finalizeErr: any) {
          logErr("cerere_finalize_failed", { message: String(finalizeErr?.message || finalizeErr || "error") });
        }
        return NextResponse.json({
          ok: true,
          acreditareId: acreditareDocId,
          alreadyApproved: true,
          requestId,
          email: {
            to: to || null,
            sent: false,
            attachPdf: false,
            skipReason: "already_approved",
          },
        });
      }
      throw e;
    }
    log("acreditare_created", { acreditareId, numar: acrDoc.numar, data: acrDoc.data });

    // Post-create same-year re-check (TOCTOU): two concurrent approves for the same person
    // can both pass the pre-check; roll back the loser if another same-year doc exists.
    if (!allowSameYearDuplicate) {
      try {
        const postHit = await findSameYearIssuedAcreditare({
          judetId,
          structuraId,
          jurnalist: matchJurnalist,
          year: accreditationYear,
          excludeAcreditareId: acreditareDocId,
        });
        if (postHit) {
          log("same_year_duplicate_post_create", {
            year: accreditationYear,
            createdId: acreditareDocId,
            existingId: postHit.id,
            existingNumar: postHit.numar,
          });
          try {
            await deleteAcreditareDocAdmin({
              judetId,
              structuraId,
              acreditareId: acreditareDocId,
            });
          } catch (delErr: any) {
            logErr("same_year_rollback_failed", {
              message: String(delErr?.message || delErr || "error"),
            });
          }
          return NextResponse.json(
            {
              error: `Jurnalistul are deja o acreditare emisă în ${accreditationYear}${
                postHit.numar ? ` (nr. ${postHit.numar})` : ""
              }. Confirmă explicit dacă vrei o a doua acreditare în același an.`,
              code: "same_year_duplicate",
              year: accreditationYear,
              existingAcreditareId: postHit.id || null,
              existingNumar: postHit.numar || null,
              requestId,
            },
            { status: 409 }
          );
        }
      } catch (e: any) {
        logErr("same_year_post_check_failed", { message: String(e?.message || e || "error") });
      }
    }

    try {
      await upsertJurnalistAfterIssue({ numar, data: acrData });
    } catch (e: any) {
      logErr("jurnalist_upsert_failed", { message: String(e?.message || e || "error") });
      // Non-fatal: document exists; retry recovers via existing_acreditare without allocating again.
    }

    await finalizeCerereApproval({
      cerereId: id,
      idToken,
      cerere,
      statusByStructura,
      currentKey,
      currentStatus,
      nowIso,
      authUser,
      acreditareId,
      numar,
      acrData,
    });
    log("cerere->approved", { acreditareId });

    // Email (optional)
    let emailSent = false;
    let emailAttachPdf = false;
    let emailSkipReason: "missing_recipient" | "missing_smtp" | "send_failed" | "not_attempted" | "already_approved" | null = null;
    if (to) {
      const gen = await firestoreGetDocAsJson<any>(`Judete/${judetId}/Structuri/${structuraId}/Settings/general`, idToken).catch(() => null);
      const replyTo = String(gen?.email || "").trim() || undefined;
      const smtpUser = process.env.SMTP_USER || "";
      const smtpPass = process.env.SMTP_PASS || "";
      if (smtpUser && smtpPass) {
        const structLabel = `${structuraId} ${judetId}`;
        const origin = new URL(req.url).origin;
        const downloadUrl = buildPublicAcreditarePdfUrl({
          origin,
          acreditareId,
          judetId,
          structuraId,
        });
        emailAttachPdf = false;
        log("email_attempt", { to, replyTo: replyTo || null, smtpUser, downloadUrl });
        try {
          await sendMailGmailSmtp({
            smtpUser,
            smtpPass,
            to,
            subject: `Acreditare acceptată ${structLabel}`,
            text:
              `Acreditarea dvs pe anul ${accreditationYear} a fost acceptată la ${structLabel}.\n\n` +
              `Descarcă acreditarea (link cu valabilitate limitată):\n${downloadUrl}\n` +
              `Cu stimă,\n` +
              `COMPARTIMENT INFORMARE RELAȚII PUBLICE`,
            replyTo,
          });
          log("email_success", { to });
          emailSent = true;
          emailSkipReason = null;
        } catch (e: any) {
          logErr("email_failed", { to, message: String(e?.message || e || "error") });
          emailSent = false;
          emailSkipReason = "send_failed";
        }
      } else {
        log("email_skip_missing_smtp", { to, hasUser: !!smtpUser, hasPass: !!smtpPass });
        emailSent = false;
        emailSkipReason = "missing_smtp";
      }
    } else {
      log("email_skip_missing_recipient");
      emailSent = false;
      emailSkipReason = "missing_recipient";
    }

    if (!emailSkipReason && !emailSent) emailSkipReason = "not_attempted";
    return NextResponse.json({
      ok: true,
      acreditareId,
      requestId,
      email: {
        to: to || null,
        sent: emailSent,
        attachPdf: emailAttachPdf,
        skipReason: emailSkipReason,
      },
    });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "error";
    logErr("failed", errorLogFields(e));
    if (msg === "missing_auth") return NextResponse.json({ error: "Missing Authorization", requestId }, { status: 401 });
    if (msg === "invalid_token") return NextResponse.json({ error: "Invalid token", requestId }, { status: 401 });
    return NextResponse.json({ error: "Approve failed", requestId }, { status: 500 });
  }
}

