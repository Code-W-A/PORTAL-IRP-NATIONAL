"use client";

import { useCallback, useEffect, useState } from "react";
import { doc, getDoc, getDocs, orderBy, query } from "firebase/firestore";

import {
  getReportsCollection,
  getReportTypesCollection,
  normalizeReportDoc,
  normalizeTypeDoc,
} from "@/app/(admin-irp)/dashboard/raportari/_core/firestore";
import { loadRaportariSettings } from "@/app/(admin-irp)/dashboard/raportari/_core/raportariSettings";
import { seedReportTypesIfMissing } from "@/app/(admin-irp)/dashboard/raportari/_core/templates/seedReportTypes";
import type {
  RaportariSettingsDoc,
  ReportInstanceDoc,
  ReportSettingsStatus,
  ReportTypeDoc,
} from "@/app/(admin-irp)/dashboard/raportari/_core/types";
import { initFirebase } from "@/lib/firebase";

async function getAuthTokenOrThrow() {
  const { auth } = initFirebase();
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Autentificarea este necesară.");
  return token;
}

export function useRaportariData() {
  const [types, setTypes] = useState<ReportTypeDoc[]>([]);
  const [reports, setReports] = useState<ReportInstanceDoc[]>([]);
  const [prefs, setPrefs] = useState<RaportariSettingsDoc>({ byTypeId: {} });
  const [settingsStatus, setSettingsStatus] = useState<ReportSettingsStatus | null>(null);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingReports, setLoadingReports] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTypes = useCallback(async () => {
    setLoadingTypes(true);
    try {
      const { db } = initFirebase();
      await seedReportTypesIfMissing(db);
      const coll = getReportTypesCollection(db);
      const snap = await getDocs(query(coll, orderBy("updatedAt", "desc")));
      const next = snap.docs.map((typeDoc) => normalizeTypeDoc(typeDoc.data(), typeDoc.id));
      setTypes(next.filter((item) => !item.archived));
    } catch {
      setError("Nu am putut încărca tipurile de raportare.");
    } finally {
      setLoadingTypes(false);
    }
  }, []);

  const loadReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const { db } = initFirebase();
      const coll = getReportsCollection(db);
      const snap = await getDocs(query(coll, orderBy("updatedAt", "desc")));
      const next = snap.docs.map((reportDoc) => normalizeReportDoc(reportDoc.data(), reportDoc.id));
      setReports(next);
    } catch {
      setError("Nu am putut încărca raportările.");
    } finally {
      setLoadingReports(false);
    }
  }, []);

  const loadPrefs = useCallback(async () => {
    const { db } = initFirebase();
    const next = await loadRaportariSettings(db);
    setPrefs(next);
  }, []);

  const loadTypeById = useCallback(async (typeId: string) => {
    const { db } = initFirebase();
    await seedReportTypesIfMissing(db);
    const coll = getReportTypesCollection(db);
    const snap = await getDoc(doc(coll, typeId));
    if (!snap.exists()) return null;
    return normalizeTypeDoc(snap.data(), snap.id);
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadTypes(), loadReports(), loadPrefs()]);
  }, [loadPrefs, loadReports, loadTypes]);

  useEffect(() => {
    void loadTypes();
    void loadReports();
    void loadPrefs();
  }, [loadPrefs, loadReports, loadTypes]);

  useEffect(() => {
    async function fetchSettingsStatus() {
      try {
        const token = await getAuthTokenOrThrow();
        const res = await fetch("/api/raportari/settings", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as ReportSettingsStatus;
        setSettingsStatus(data);
      } catch {}
    }
    void fetchSettingsStatus();
  }, []);

  return {
    types,
    reports,
    prefs,
    settingsStatus,
    loadingTypes,
    loadingReports,
    error,
    setError,
    loadTypeById,
    refreshAll,
    loadReports,
    loadPrefs,
  };
}