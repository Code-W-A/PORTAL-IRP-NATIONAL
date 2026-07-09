import { NextResponse } from "next/server";
import React from "react";
import { pdf, type DocumentProps } from "@react-pdf/renderer";

import { reportExportSchema } from "@/app/(admin-irp)/dashboard/raportari/_core/schema";
import { DynamicReportPdfDoc } from "@/app/(admin-irp)/dashboard/raportari/_core/pdf";
import { safeFilename } from "@/app/(admin-irp)/dashboard/raportari/_core/title";
import { requireBearerToken } from "@/lib/server/auth";
import { getStructuraSettings } from "@/lib/settings/getSettings";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const idToken = await requireBearerToken(req);
    const origin = new URL(req.url).origin;
    const { settings, structura } = await getStructuraSettings(idToken, origin);
    if (!structura?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const payload = reportExportSchema.parse(body);

    const doc = React.createElement(DynamicReportPdfDoc, {
      settings,
      data: {
        typeId: payload.report.typeId,
        title: payload.report.title,
        registrationNumber: payload.report.registrationNumber,
        periodStart: payload.report.periodStart,
        periodEnd: payload.report.periodEnd,
        columns: payload.report.columnsSnapshot,
        rows: payload.report.rows,
        includeSignatures: payload.includeSignatures,
      },
    }) as unknown as React.ReactElement<DocumentProps>;

    const blob = await pdf(doc).toBlob();
    const filename = `${safeFilename(payload.report.title)}.pdf`;

    return new NextResponse(blob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    if (error?.message === "missing_auth") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "missing_tenant") {
      return NextResponse.json({ error: "Profil incomplet (judetId/structuraId)." }, { status: 403 });
    }
    if (error?.issues) {
      return NextResponse.json({ error: "Invalid payload", issues: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
