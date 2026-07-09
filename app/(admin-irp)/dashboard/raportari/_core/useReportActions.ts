"use client";

import { useCallback } from "react";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

import {
  createId,
  getReportsCollection,
  normalizeReportDoc,
} from "@/app/(admin-irp)/dashboard/raportari/_core/firestore";
import { saveRaportariTypePrefs } from "@/app/(admin-irp)/dashboard/raportari/_core/raportariSettings";
import {
  downloadBlob,
  normalizeReportDraft,
  type ReportDraft,
} from "@/app/(admin-irp)/dashboard/raportari/_core/reportDraft";
import { reportExportSchema, reportInstanceSchema } from "@/app/(admin-irp)/dashboard/raportari/_core/schema";
import { safeFilename } from "@/app/(admin-irp)/dashboard/raportari/_core/title";
import type { ReportInstanceDoc } from "@/app/(admin-irp)/dashboard/raportari/_core/types";
import { initFirebase } from "@/lib/firebase";

async function getAuthTokenOrThrow() {
  const { auth } = initFirebase();
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Autentificarea este necesară.");
  return token;
}

export function useReportActions() {
  const loadReportDraft = useCallback(async (reportId: string, fallback?: ReportInstanceDoc): Promise<ReportDraft> => {
    if (fallback) {
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = fallback;
      return normalizeReportDraft(rest);
    }
    const { db } = initFirebase();
    const coll = getReportsCollection(db);
    const snap = await getDoc(doc(coll, reportId));
    if (!snap.exists()) throw new Error("missing_report");
    const normalized = normalizeReportDoc(snap.data(), snap.id);
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = normalized;
    return normalizeReportDraft(rest);
  }, []);

  const saveReport = useCallback(async (draft: ReportDraft, reportId?: string) => {
    const normalized = normalizeReportDraft(draft);
    const payload = reportInstanceSchema.parse(normalized);
    const targetId = reportId || createId();

    const { db } = initFirebase();
    const coll = getReportsCollection(db);
    await setDoc(
      doc(coll, targetId),
      {
        ...payload,
        updatedAt: serverTimestamp(),
        ...(!reportId ? { createdAt: serverTimestamp() } : {}),
      },
      { merge: true }
    );

    await saveRaportariTypePrefs(db, payload.typeId, {
      lastPeriodStart: payload.periodStart,
      lastPeriodEnd: payload.periodEnd,
      lastRegistrationNumber: payload.registrationNumber,
    });

    return { id: targetId, payload };
  }, []);

  const deleteReport = useCallback(async (reportId: string) => {
    const { db } = initFirebase();
    const coll = getReportsCollection(db);
    await deleteDoc(doc(coll, reportId));
  }, []);

  const exportReport = useCallback(async (kind: "pdf" | "excel", report: ReportDraft, includeSignatures = true) => {
    const normalizedReport = normalizeReportDraft(report);
    const payload = reportExportSchema.parse({
      report: normalizedReport,
      includeSignatures,
    });

    const token = await getAuthTokenOrThrow();
    const endpoint = kind === "pdf" ? "/api/raportari/export/pdf" : "/api/raportari/export/excel";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error("Exportul nu a putut fi generat.");
    const blob = await response.blob();
    const extension = kind === "pdf" ? "pdf" : "xlsx";
    downloadBlob(blob, `${safeFilename(normalizedReport.title)}.${extension}`);
  }, []);

  return {
    loadReportDraft,
    saveReport,
    deleteReport,
    exportReport,
  };
}
