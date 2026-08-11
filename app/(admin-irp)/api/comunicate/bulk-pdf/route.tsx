import { NextResponse } from "next/server";
import React from "react";
import { pdf, Document } from "@react-pdf/renderer";

import { createBicpPage } from "@/app/(admin-irp)/components/pdf/BicpPdf";
import { JUDETE } from "@/lib/judete";
import { buildPurtatorSignatureUrl, normalizePurtatorSignatureKey } from "@/lib/pdf/purtatorSignatures";
import { BULK_PDF_MAX_IDS } from "@/lib/bicp/bulkLimits";
import { requireBearerToken } from "@/lib/server/auth";
import { firestoreGetDocAsJson } from "@/lib/server/firestoreRest";
import { getStructuraSettings } from "@/lib/settings/getSettings";

export const runtime = "nodejs";

function toDDMMYYYYDots(str?: string): string {
  const s = String(str || "").trim();
  if (!s) return "";
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}.${m[2]}.${m[1]}`;
  const m2 = s.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
  if (m2) return `${m2[1]}.${m2[2]}.${m2[3]}`;
  return s.replace(/-/g, ".").replace(/\//g, ".");
}

export async function POST(req: Request) {
  try {
    const idToken = await requireBearerToken(req);
    const origin = new URL(req.url).origin;
    const { tenant, settings, structura } = await getStructuraSettings(idToken, origin);
    const judetId = tenant.judetId;
    const structuraId = tenant.structuraId;

    const body = (await req.json().catch(() => ({}))) as {
      ids?: string[];
      variant?: "signed" | "public";
    };
    const ids = Array.isArray(body.ids)
      ? Array.from(new Set(body.ids.map((x) => String(x || "").trim()).filter(Boolean)))
      : [];
    if (!ids.length) {
      return NextResponse.json({ error: "No ids provided" }, { status: 400 });
    }
    if (ids.length > BULK_PDF_MAX_IDS) {
      return NextResponse.json(
        {
          error: `Poți tipări maxim ${BULK_PDF_MAX_IDS} documente odată. Ai selectat ${ids.length}.`,
          code: "bulk_too_many",
          max: BULK_PDF_MAX_IDS,
          requested: ids.length,
        },
        { status: 400 }
      );
    }

    const v: "signed" | "public" = body.variant === "public" ? "public" : "signed";
    const meta = settings || (await firestoreGetDocAsJson<any>(
      `Judete/${judetId}/Structuri/${structuraId}/Settings/general`,
      idToken
    ).catch(() => null));
    const logoAbs = meta?.logoUrlPublic
      ? new URL(String(meta.logoUrlPublic), origin).toString()
      : undefined;
    const structuraIsAdmin = structura?.isAdmin === true;
    const judName = JUDETE.find((j) => j.id === judetId)?.name || judetId;
    let structureDisplay = `${structuraId} ${judName}`;
    if (String(structuraId || "").toUpperCase().includes("IGSU")) {
      structureDisplay = String(structuraId || "");
    }

    const pages: React.ReactNode[] = [];
    const missing: string[] = [];

    for (const id of ids) {
      let d =
        (await firestoreGetDocAsJson<any>(
          `Judete/${judetId}/Structuri/${structuraId}/Comunicate/${id}`,
          idToken
        ).catch(() => null)) ||
        (await firestoreGetDocAsJson<any>(`Comunicate/${id}`, idToken).catch(() => null));

      if (!d) {
        missing.push(id);
        continue;
      }

      // Guard: if legacy root doc carries another tenant, skip rather than leaking.
      const docJudet = String(d?.judetId || "").toUpperCase();
      const docStruct = String(d?.structuraId || "").toUpperCase();
      if (docJudet && docStruct && (docJudet !== judetId || docStruct !== structuraId)) {
        missing.push(id);
        continue;
      }

      const content = String(d?.comunicat || "");
      const chosenNumar =
        v === "signed" && String(d?.numarRegistru || "").trim()
          ? String(d.numarRegistru).trim()
          : String(d?.numarComunicat ?? d?.numar ?? "");

      const purtatorSemnaturaUrl =
        v === "signed" && structuraIsAdmin
          ? buildPurtatorSignatureUrl(normalizePurtatorSignatureKey(d?.purtatorSemnaturaKey), origin)
          : undefined;

      pages.push(
        createBicpPage({
          settings: {
            headerLines: (meta?.headerLines as string[]) || [],
            logoUrlPublic: logoAbs,
            secrecyLabel: meta?.secrecyLabel || "NESECRET",
            city: meta?.city,
            email: meta?.email,
            phone: meta?.phone,
            footerLines: (meta?.footerLines as string[]) || [],
            unitLabel: meta?.unitLabel || "",
            structureDisplay,
            assetBaseUrl: origin,
          },
          data: {
            numar: chosenNumar,
            dateLabel: toDDMMYYYYDots(d?.data),
            purtator: d?.["purtator-cuvant"] || "",
            purtatorSemnaturaUrl,
            tipDocument: d?.nume || d?.tip || "",
            titlu: d?.titlu || "",
            continut: content,
            continutHtml: String(d?.comunicatHtml || ""),
            semnatar: {
              pentru: d?.pentru || "",
              functia: d?.functia || "",
              grad: d?.grad || "",
              nume: d?.numeSemnatar || "",
            },
          },
          variant: v,
        })
      );
    }

    if (!pages.length) {
      return NextResponse.json(
        { error: "Niciun document valid pentru tipărire.", missing, requested: ids.length },
        { status: 404 }
      );
    }

    const DocEl = <Document>{pages}</Document>;
    const blob = await pdf(DocEl).toBlob();
    return new NextResponse(blob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="comunicate_bulk_${v}.pdf"`,
        "X-Bulk-Requested": String(ids.length),
        "X-Bulk-Included": String(pages.length),
        "X-Bulk-Missing": String(missing.length),
        "X-Bulk-Missing-Ids": missing.slice(0, 20).join(","),
      },
    });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "error";
    if (msg === "missing_auth") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (msg === "invalid_token") return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    if (msg === "missing_tenant") {
      return NextResponse.json({ error: "Profil incomplet (judetId/structuraId)." }, { status: 403 });
    }
    console.error("[comunicate][bulk-pdf] failed", msg);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
