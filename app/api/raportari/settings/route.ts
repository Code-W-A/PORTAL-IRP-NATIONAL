import { NextResponse } from "next/server";

import { getSignaturesFromSettings } from "@/app/(admin-irp)/dashboard/raportari/_core/settings";
import { requireBearerToken } from "@/lib/server/auth";
import { getStructuraSettings } from "@/lib/settings/getSettings";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const idToken = await requireBearerToken(req);
    const origin = new URL(req.url).origin;
    const { settings, structura } = await getStructuraSettings(idToken, origin);
    if (!structura?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const signatures = getSignaturesFromSettings(settings);
    return NextResponse.json({
      hasIntocmit: !!signatures.intocmit?.nume,
      hasAprobat: !!signatures.aprobat?.nume,
      intocmit: signatures.intocmit || null,
      aprobat: signatures.aprobat || null,
    });
  } catch (error: any) {
    if (error?.message === "missing_auth") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "missing_tenant") {
      return NextResponse.json({ error: "Profil incomplet (judetId/structuraId)." }, { status: 403 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
