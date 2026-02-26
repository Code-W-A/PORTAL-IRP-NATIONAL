import { NextResponse } from "next/server";
import React from "react";
import { pdf, type DocumentProps } from "@react-pdf/renderer";
import { z } from "zod";

import { PressKitPdf } from "@/app/(admin-irp)/components/pdf/PressKitPdf";
import { DEFAULT_PRESS_KIT_INVITATION_NOTE } from "@/app/(admin-irp)/mape-presa/_core/types";
import { requireBearerToken } from "@/lib/server/auth";
import { getStructuraSettings } from "@/lib/settings/getSettings";

export const runtime = "nodejs";

const pressKitSchema = z.object({
  conference: z.object({
    date: z.string().trim().min(1),
    time: z.string().trim().min(1),
    year: z.string().trim().min(1),
  }),
  conferenceMaterial: z
    .object({
      title: z.string().trim().optional().default(""),
      content: z.string().trim().optional().default(""),
    })
    .optional()
    .default({ title: "", content: "" }),
  contact: z.object({
    name: z.string().trim().min(1),
    role: z.string().trim().min(1),
    phone: z.string().trim().min(1),
    email: z.string().trim().min(1),
  }),
  hosts: z.array(z.string().trim()).default([]),
  institutionContact: z.object({
    address: z.string().trim().min(1),
    phoneFax: z.string().trim().min(1),
    email: z.string().trim().min(1),
    website: z.string().trim().min(1),
  }),
  leadership: z.object({
    inspectorSef: z.string().trim().min(1),
    primAdjunct: z.string().trim().min(1),
    adjunct: z.string().trim().min(1),
  }),
  spokesperson: z.object({
    name: z.string().trim().min(1),
    email: z.string().trim().min(1),
    phone: z.string().trim().min(1),
  }),
  journalists: z
    .array(
      z.object({
        fullNameAndRole: z.string().trim().optional().default(""),
        trust: z.string().trim().optional().default(""),
      })
    )
    .default([]),
  intocmit: z.object({
    name: z.string().trim().min(1),
  }),
  invitationNote: z
    .string()
    .trim()
    .min(1)
    .optional()
    .default(DEFAULT_PRESS_KIT_INVITATION_NOTE),
});

export async function POST(req: Request) {
  try {
    const idToken = await requireBearerToken(req);
    const origin = new URL(req.url).origin;
    const { settings, structura } = await getStructuraSettings(idToken, origin);
    if (!structura?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload = pressKitSchema.parse(await req.json());

    const doc = React.createElement(PressKitPdf, {
      settings: {
        headerLines: settings?.headerLines || [],
        footerLines: settings?.footerLines || [],
        logoUrlPublic: settings?.logoUrlPublic || "",
        assetBaseUrl: origin,
      },
      data: payload,
    }) as unknown as React.ReactElement<DocumentProps>;

    const blob = await pdf(doc).toBlob();

    return new NextResponse(blob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="mapa-de-presa.pdf"',
      },
    });
  } catch (error: any) {
    if (error?.message === "missing_auth") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error?.message === "missing_tenant") {
      return NextResponse.json(
        { error: "Profil incomplet (judetId/structuraId)." },
        { status: 403 }
      );
    }
    if (error?.issues) {
      return NextResponse.json(
        { error: "Invalid payload", issues: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
