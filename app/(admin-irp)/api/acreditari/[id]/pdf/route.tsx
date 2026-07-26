import { NextResponse } from "next/server";
import React from "react";
import { pdf } from "@react-pdf/renderer";

import { AcreditarePdfDoc } from "@/app/(admin-irp)/components/pdf/AcreditarePdf";
import { lookupUserFromIdToken, requireBearerToken } from "@/lib/server/auth";
import {
  loadAcreditarePublicPdfBundle,
  loadAcreditareSignatureSettings,
} from "@/lib/server/acreditarePdfSettings";
import {
  extractAcreditarePdfDownloadToken,
  verifyAcreditarePdfToken,
} from "@/lib/server/acreditarePdfToken";
import {
  createAcreditareLogger,
  errorLogFields,
  newAcreditareRequestId,
} from "@/lib/server/acreditareLogger";
import { getStructuraSettings } from "@/lib/settings/getSettings";
import { firestoreGetDocAsJson } from "@/lib/server/firestoreRest";

export const runtime = "nodejs";

function toDDMMYYYYSlashes(str?: string): string {
  const s = String(str || "").trim();
  if (!s) return "";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const m2 = s.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (m2) return `${m2[1]}/${m2[2]}/${m2[3]}`;
  const m3 = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (m3) return `${m3[1]}/${m3[2]}/${m3[3]}`;
  return s.replace(/\./g, "/").replace(/-/g, "/");
}

function pdfResponse(blob: Blob, nume: string, variant: "signed" | "public") {
  const suffix = variant === "public" ? "_fara_semnaturi" : "_cu_semnaturi";
  return new NextResponse(blob, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="acreditare_${String(nume || "").replace(/\W+/g, "_")}${suffix}.pdf"`,
    },
  });
}

function pdfDataFromAcreditare(d: Record<string, any>) {
  return {
    numar: String(d?.numar || ""),
    dateLabel: toDDMMYYYYSlashes(d?.data),
    nume: d?.nume || "",
    legit: d?.legit || "",
    redactie: d?.redactie || "",
    sex: (String(d?.sex || "").toUpperCase() === "M"
      ? "M"
      : String(d?.sex || "").toUpperCase() === "F"
        ? "F"
        : undefined) as "F" | "M" | undefined,
  };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const requestId = newAcreditareRequestId("acr_pdf");
  let logger = createAcreditareLogger({ area: "pdf", requestId });
  try {
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const variant = String(url.searchParams.get("variant") || "").toLowerCase() === "public" ? "public" : "signed";
    const origin = url.origin;
    const qpJudet = url.searchParams.get("judetId") || undefined;
    const qpStruct = url.searchParams.get("structuraId") || undefined;
    logger.info("start", { acreditareId: id, variant });

    // Signed PDFs (with official signature images) require structura admin (not any tenant user).
    if (variant === "signed") {
      const idToken = await requireBearerToken(req);
      let tenant;
      try {
        const resolved = await getStructuraSettings(idToken, origin);
        tenant = resolved.tenant;
        if (!resolved.structura?.isAdmin) {
          logger.warn("forbidden_not_admin", { acreditareId: id });
          return NextResponse.json(
            { error: "Forbidden: doar adminul structurii poate descărca PDF-ul semnat.", requestId },
            { status: 403 }
          );
        }
      } catch (e: any) {
        const msg = String(e?.message || e || "");
        if (msg === "missing_tenant") {
          logger.warn("missing_tenant");
          return NextResponse.json({ error: "Profil incomplet (judetId/structuraId).", requestId }, { status: 403 });
        }
        throw e;
      }
      const judetId = tenant.judetId;
      const structuraId = tenant.structuraId;
      logger = createAcreditareLogger({
        area: "pdf",
        requestId,
        tenant: { judetId, structuraId, uid: tenant.uid },
      });

      const acrPath = `Judete/${judetId}/Structuri/${structuraId}/Acreditari/${id}`;
      const d = await firestoreGetDocAsJson<any>(acrPath, idToken);
      if (!d) {
        logger.warn("not_found", { acreditareId: id, variant: "signed" });
        return NextResponse.json({ error: "Not found", requestId }, { status: 404 });
      }

      const settings = await firestoreGetDocAsJson<any>(
        `Judete/${judetId}/Structuri/${structuraId}/Settings/general`,
        idToken
      ).catch(() => null);
      const secrets = await loadAcreditareSignatureSettings(judetId, structuraId);

      const DocPdf = (
        <AcreditarePdfDoc
          settings={{
            headerLines: (settings?.headerLines as string[]) || [],
            logoUrlPublic: settings?.logoUrlPublic
              ? new URL(String(settings.logoUrlPublic), origin).toString()
              : undefined,
            unitLabel: settings?.unitLabel,
            city: settings?.city,
            phone: settings?.phone,
            footerLines: settings?.footerLines || [],
            acreditareSemnatarStanga: secrets.acreditareSemnatarStanga ?? settings?.acreditareSemnatarStanga,
            acreditareSemnatarDreapta: secrets.acreditareSemnatarDreapta ?? settings?.acreditareSemnatarDreapta,
            acreditareSemnatarStangaImg: secrets.acreditareSemnatarStangaImg || undefined,
            acreditareSemnatarDreaptaImg: secrets.acreditareSemnatarDreaptaImg || undefined,
            assetBaseUrl: origin,
          }}
          variant="signed"
          data={pdfDataFromAcreditare(d)}
        />
      );

      const blob = await pdf(DocPdf).toBlob();
      logger.info("ok", { acreditareId: id, variant: "signed", bytes: blob.size });
      return pdfResponse(blob, String(d?.nume || ""), "signed");
    }

    // Public variant — requires download token (email links) or admin Bearer for same tenant.
    const judetId = String(qpJudet || "").toUpperCase();
    const structuraId = String(qpStruct || "").toUpperCase();
    if (!judetId || !structuraId) {
      logger.warn("missing_tenant_query");
      return NextResponse.json(
        { error: "judetId and structuraId query params are required for public PDF.", requestId },
        { status: 400 }
      );
    }
    logger = createAcreditareLogger({
      area: "pdf",
      requestId,
      tenant: { judetId, structuraId },
    });

    // Prefer header / Authorization over ?token= (query leaks via logs and Referer).
    const token = extractAcreditarePdfDownloadToken(req, url);
    let publicAuthorized = false;
    let authVia: "token" | "bearer" | null = null;
    if (token) {
      const verified = verifyAcreditarePdfToken(token, {
        acreditareId: id,
        judetId,
        structuraId,
      });
      if (!verified.ok) {
        logger.warn("token_invalid", { reason: verified.reason, acreditareId: id });
        const status = verified.reason === "expired" ? 410 : 403;
        return NextResponse.json(
          {
            error:
              verified.reason === "expired"
                ? "Link-ul de descărcare a expirat. Cere retransmiterea emailului."
                : "Link de descărcare invalid.",
            reason: verified.reason,
            requestId,
          },
          { status }
        );
      }
      publicAuthorized = true;
      authVia = "token";
    } else {
      try {
        const idToken = await requireBearerToken(req);
        const authUser = await lookupUserFromIdToken(idToken);
        const profile = await firestoreGetDocAsJson<{ judetId?: string; structuraId?: string }>(
          `users/${authUser.uid}`,
          idToken
        );
        const profileJudet = String(profile?.judetId || "").toUpperCase();
        const profileStruct = String(profile?.structuraId || "").toUpperCase();
        if (profileJudet === judetId && profileStruct === structuraId) {
          publicAuthorized = true;
          authVia = "bearer";
        }
      } catch {
        publicAuthorized = false;
      }
    }

    if (!publicAuthorized) {
      logger.warn("unauthorized_public", { acreditareId: id });
      return NextResponse.json(
        {
          error: "Missing or invalid download token. Public PDF requires a signed link or admin auth.",
          requestId,
        },
        { status: 401 }
      );
    }

    const bundle = await loadAcreditarePublicPdfBundle({
      acreditareId: id,
      judetId,
      structuraId,
    });
    if (!bundle) {
      logger.warn("not_found", { acreditareId: id, variant: "public" });
      return NextResponse.json({ error: "Not found", requestId }, { status: 404 });
    }

    const { acreditare: d, settings } = bundle;
    const DocPdf = (
      <AcreditarePdfDoc
        settings={{
          headerLines: settings.headerLines,
          logoUrlPublic: settings.logoUrlPublic
            ? new URL(String(settings.logoUrlPublic), origin).toString()
            : undefined,
          unitLabel: settings.unitLabel,
          city: settings.city,
          phone: settings.phone,
          footerLines: settings.footerLines || [],
          acreditareSemnatarStanga: settings.acreditareSemnatarStanga,
          acreditareSemnatarDreapta: settings.acreditareSemnatarDreapta,
          assetBaseUrl: origin,
        }}
        variant="public"
        data={pdfDataFromAcreditare(d)}
      />
    );

    const blob = await pdf(DocPdf).toBlob();
    logger.info("ok", { acreditareId: id, variant: "public", authVia, bytes: blob.size });
    return pdfResponse(blob, String(d?.nume || ""), "public");
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "error";
    logger.error("failed", errorLogFields(e));
    if (msg === "missing_auth") return NextResponse.json({ error: "Missing Authorization", requestId }, { status: 401 });
    if (msg === "invalid_token") return NextResponse.json({ error: "Invalid token", requestId }, { status: 401 });
    if (msg === "missing_tenant_query") {
      return NextResponse.json(
        { error: "judetId and structuraId query params are required for public PDF.", requestId },
        { status: 400 }
      );
    }
    if (msg === "missing_pdf_token_secret") {
      return NextResponse.json({ error: "Server misconfigured (PDF token secret).", requestId }, { status: 500 });
    }
    if (typeof msg === "string" && msg.startsWith("missing_env:")) {
      return NextResponse.json({ error: "Server misconfigured (Firebase Admin).", requestId }, { status: 500 });
    }
    return NextResponse.json({ error: "PDF generation failed", requestId }, { status: 500 });
  }
}
