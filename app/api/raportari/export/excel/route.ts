import { NextResponse } from "next/server";

import { buildDynamicReportWorkbook } from "@/app/(admin-irp)/dashboard/raportari/_core/excel";
import { reportExportSchema } from "@/app/(admin-irp)/dashboard/raportari/_core/schema";
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

    const workbook = await buildDynamicReportWorkbook(
      payload.report,
      settings,
      payload.includeSignatures
    );
    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `${safeFilename(payload.report.title)}.xlsx`;

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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
