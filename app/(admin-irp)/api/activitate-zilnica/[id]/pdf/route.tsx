import { NextResponse } from "next/server";
import React from "react";
import { pdf } from "@react-pdf/renderer";
import { doc, getDoc } from "firebase/firestore";

import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";
import { DailyActivityPdfDoc } from "@/app/(admin-irp)/components/pdf/DailyActivityPdf";

function slugifyFilename(input: string) {
  const map: Record<string, string> = {
    "ă": "a",
    "â": "a",
    "î": "i",
    "ș": "s",
    "ş": "s",
    "ț": "t",
    "ţ": "t",
    "Ă": "A",
    "Â": "A",
    "Î": "I",
    "Ș": "S",
    "Ş": "S",
    "Ț": "T",
    "Ţ": "T",
  };
  const normalized = Array.from(String(input || ""))
    .map((char) => map[char] || char)
    .join("");

  return (
    normalized
      .replace(/[^a-zA-Z0-9._\-\s]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()
      .slice(0, 150) || "activitate_zilnica"
  );
}

function resolveTenantFromRefPath(path: string) {
  const parts = String(path || "").split("/");
  const judetIndex = parts.indexOf("Judete");
  const structuraIndex = parts.indexOf("Structuri");
  return {
    judetId:
      judetIndex >= 0 && parts[judetIndex + 1] ? parts[judetIndex + 1] : "",
    structuraId:
      structuraIndex >= 0 && parts[structuraIndex + 1]
        ? parts[structuraIndex + 1]
        : "",
  };
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const disposition =
    url.searchParams.get("disposition") === "inline" ? "inline" : "attachment";
  const qpJudet = String(url.searchParams.get("judetId") || "").trim();
  const qpStructura = String(url.searchParams.get("structuraId") || "").trim();
  const { db } = initFirebase();

  let snap: any = null;
  if (qpJudet && qpStructura) {
    const scopedRef = doc(
      db,
      `Judete/${qpJudet}/Structuri/${qpStructura}/ActivitateZilnicaRapoarte/${id}`
    );
    const scopedSnap = await getDoc(scopedRef);
    if (scopedSnap.exists()) snap = scopedSnap;
  }

  if (!snap) {
    try {
      const { judetId, structuraId } = getTenantContext();
      const fallbackRef = doc(
        db,
        `Judete/${judetId}/Structuri/${structuraId}/ActivitateZilnicaRapoarte/${id}`
      );
      const fallbackSnap = await getDoc(fallbackRef);
      if (fallbackSnap.exists()) snap = fallbackSnap;
    } catch {}
  }

  if (!snap || !snap.exists()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const data = snap.data() as any;
  const tenantFromPath = resolveTenantFromRefPath((snap as any).ref?.path || "");
  const effectiveJudetId = qpJudet || tenantFromPath.judetId;
  const effectiveStructuraId = qpStructura || tenantFromPath.structuraId;

  let settings: any = null;
  if (effectiveJudetId && effectiveStructuraId) {
    try {
      const settingsRef = doc(
        db,
        `Judete/${effectiveJudetId}/Structuri/${effectiveStructuraId}/Settings/general`
      );
      const settingsSnap = await getDoc(settingsRef);
      settings = settingsSnap.exists() ? settingsSnap.data() : null;
    } catch {}
  }

  const origin = new URL(req.url).origin;
  const logoAbs = settings?.logoUrlPublic
    ? new URL(String(settings.logoUrlPublic), origin).toString()
    : undefined;

  const activities = Array.isArray(data?.activities)
    ? data.activities.map((item: any) => ({
        intervalOrar: String(item?.intervalOrar || item?.ora || "").trim(),
        activitate: String(item?.activitate || "").trim(),
        executant: String(item?.executant || "").trim(),
        observatii: String(item?.observatii || "").trim(),
      }))
    : [];

  const docEl = (
    <DailyActivityPdfDoc
      settings={{
        headerLines: Array.isArray(settings?.headerLines)
          ? settings.headerLines
          : [],
        footerLines: Array.isArray(settings?.footerLines)
          ? settings.footerLines
          : [],
        logoUrlPublic: logoAbs,
        unitLabel: String(settings?.unitLabel || ""),
        city: String(settings?.city || ""),
        secrecyLabel: String(settings?.secrecyLabel || "NESECRET"),
        showHeaderTricolor:
          settings?.showHeaderTricolor !== false ? true : false,
        showTricolorFooter:
          settings?.showTricolorFooter !== false ? true : false,
        assetBaseUrl: origin,
      }}
      data={{
        reportDate: String(data?.reportDate || ""),
        title: String(data?.title || "Raport activitate zilnică"),
        registrationNumber: String(data?.registrationNumber || ""),
        activities,
        intocmit: { nume: String(data?.intocmit?.nume || "") },
        aprobat: {
          functia: String(data?.aprobat?.functia || ""),
          grad: String(data?.aprobat?.grad || ""),
          nume: String(data?.aprobat?.nume || ""),
        },
      }}
    />
  );

  const blob = await pdf(docEl).toBlob();
  const baseName = slugifyFilename(
    `activitate_zilnica_${String(data?.reportDate || "")}_${String(
      data?.title || ""
    )}`
  );

  return new NextResponse(blob, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${baseName}.pdf"`,
    },
  });
}
