"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Copy,
  FileStack,
  Grid2X2,
  Plus,
  Printer,
  Rows2,
  Save,
  Search,
  Trash2,
} from "lucide-react";

import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";
import {
  buildReportTimestamp,
  createId,
  getDailyActivityReportsCollection,
  getDailyActivityTemplatesCollection,
  normalizeReportDoc,
  normalizeTemplateDoc,
  sortReportsByUpdatedAtDesc,
  sortTemplatesByUpdatedAtDesc,
  todayYmd,
} from "@/app/(admin-irp)/activitate-zilnica/_core/firestore";
import type {
  AprobatSignature,
  DailyActivityItem,
  DailyActivityPrintSettings,
  DailyActivityReport,
  DailyActivityReportDraft,
  DailyActivityTemplate,
  DailyActivityTemplateDraft,
  IntocmitSignature,
} from "@/app/(admin-irp)/activitate-zilnica/_core/types";

type Tab = "lista-rapoarte" | "editor-raport" | "templateuri";
type ListViewMode = "card" | "table";
type ReportSortBy = "updatedAt" | "reportDate" | "title" | "activitiesCount";
type SortDir = "asc" | "desc";

type IntocmitOption = {
  nume: string;
};

type AprobatOption = {
  functia: string;
  grad: string;
  nume: string;
};

const NEW_REPORT_VALUE = "__new_report__";
const NEW_TEMPLATE_VALUE = "__new_template__";
const LIST_VIEW_STORAGE_KEY = "activitateZilnicaViewMode";

const EMPTY_PRINT_SETTINGS: DailyActivityPrintSettings = {
  headerLines: [
    "MINISTERUL AFACERILOR INTERNE",
    "DEPARTAMENTUL PENTRU SITUAȚII DE URGENȚĂ",
  ],
  footerLines: [],
  logoUrlPublic: "",
  unitLabel: "COMPARTIMENT INFORMARE ȘI RELAȚII PUBLICE",
  phone: "",
  email: "",
};

function formatDateRo(value: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const [yyyy, mm, dd] = value.split("-");
  return `${dd}.${mm}.${yyyy}`;
}

function formatDateTime(value: any) {
  try {
    if (value?.toDate) {
      const dt = value.toDate();
      if (!dt || Number.isNaN(dt.getTime())) return "";
      const date = formatDateRo(dt.toISOString().slice(0, 10));
      const time = dt.toTimeString().slice(0, 5);
      return `${date} ${time}`;
    }
    if (typeof value === "string") {
      const dt = new Date(value);
      if (!Number.isNaN(dt.getTime())) {
        const date = formatDateRo(dt.toISOString().slice(0, 10));
        const time = dt.toTimeString().slice(0, 5);
        return `${date} ${time}`;
      }
    }
  } catch {}
  return "";
}

function asTimestampMillis(value: any) {
  try {
    if (value?.toDate) {
      const dt = value.toDate();
      if (dt && !Number.isNaN(dt.getTime())) return dt.getTime();
    }
    if (value?.toMillis) {
      const millis = Number(value.toMillis());
      if (Number.isFinite(millis)) return millis;
    }
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  } catch {}
  return 0;
}

function buildDefaultReportTitle(reportDate: string) {
  return `Raport activitate zilnică - ${formatDateRo(reportDate)}`;
}

function createEmptyActivity(): DailyActivityItem {
  return {
    id: createId(),
    intervalOrar: "",
    activitate: "",
    executant: "",
    observatii: "",
  };
}

function cloneActivities(items: DailyActivityItem[], regenerateIds = false) {
  if (!items.length) return [createEmptyActivity()];
  return items.map((item) => ({
    id: regenerateIds ? createId() : item.id || createId(),
    intervalOrar: String(item.intervalOrar || ""),
    activitate: String(item.activitate || ""),
    executant: String(item.executant || ""),
    observatii: String(item.observatii || ""),
  }));
}

function createEmptyTemplateDraft(): DailyActivityTemplateDraft {
  return {
    name: "",
    description: "",
    activities: [createEmptyActivity()],
  };
}

function normalizeActivitiesForSave(items: DailyActivityItem[]) {
  return items
    .map((item) => ({
      id: item.id || createId(),
      intervalOrar: String(item.intervalOrar || "").trim(),
      activitate: String(item.activitate || "").trim(),
      executant: String(item.executant || "").trim(),
      observatii: String(item.observatii || "").trim(),
    }))
    .filter(
      (item) =>
        item.intervalOrar || item.activitate || item.executant || item.observatii
    );
}

export default function ActivitateZilnicaClient() {
  const { db, auth } = initFirebase();
  const tenant = useMemo(() => getTenantContext(), []);
  const { judetId, structuraId } = tenant;

  const [tab, setTab] = useState<Tab>("lista-rapoarte");
  const [listViewMode, setListViewMode] = useState<ListViewMode>("card");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<ReportSortBy>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [reports, setReports] = useState<DailyActivityReport[]>([]);
  const [templates, setTemplates] = useState<DailyActivityTemplate[]>([]);

  const [loadingReports, setLoadingReports] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [notice, setNotice] = useState<string | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);

  const [settingsMeta, setSettingsMeta] =
    useState<DailyActivityPrintSettings>(EMPTY_PRINT_SETTINGS);
  const [intocmitOptions, setIntocmitOptions] = useState<IntocmitOption[]>([]);
  const [aprobatOptions, setAprobatOptions] = useState<AprobatOption[]>([]);
  const [defaultIntocmit, setDefaultIntocmit] = useState<IntocmitSignature>({
    nume: "",
  });
  const [defaultAprobat, setDefaultAprobat] = useState<AprobatSignature>({
    functia: "",
    grad: "",
    nume: "",
  });

  const [selectedReportId, setSelectedReportId] = useState(NEW_REPORT_VALUE);
  const [reportDraft, setReportDraft] = useState<DailyActivityReportDraft>({
    reportDate: todayYmd(),
    title: buildDefaultReportTitle(todayYmd()),
    registrationNumber: "",
    activities: [createEmptyActivity()],
    intocmit: { nume: "" },
    aprobat: { functia: "", grad: "", nume: "" },
    templateId: null,
    createdByUid: null,
    createdByEmail: null,
  });

  const [selectedTemplateId, setSelectedTemplateId] =
    useState(NEW_TEMPLATE_VALUE);
  const [templateDraft, setTemplateDraft] = useState<DailyActivityTemplateDraft>(
    createEmptyTemplateDraft()
  );

  const [savingReport, setSavingReport] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [printingReportId, setPrintingReportId] = useState<string | null>(null);
  const [isPrintingPdf, setIsPrintingPdf] = useState(false);

  const initializedReportRef = useRef(false);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LIST_VIEW_STORAGE_KEY);
      if (saved === "card" || saved === "table") {
        setListViewMode(saved);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LIST_VIEW_STORAGE_KEY, listViewMode);
    } catch {}
  }, [listViewMode]);

  const createNewReportDraft = useCallback(
    (template?: DailyActivityTemplate): DailyActivityReportDraft => {
      const reportDate = todayYmd();
      const fromTemplate = cloneActivities(template?.activities || []);

      return {
        reportDate,
        title: template
          ? `${buildDefaultReportTitle(reportDate)} - ${template.name}`
          : buildDefaultReportTitle(reportDate),
        registrationNumber: "",
        activities: fromTemplate,
        intocmit: { ...defaultIntocmit },
        aprobat: { ...defaultAprobat },
        templateId: template?.id || null,
        createdByUid: auth.currentUser?.uid || null,
        createdByEmail: auth.currentUser?.email || null,
      };
    },
    [auth.currentUser?.email, auth.currentUser?.uid, defaultAprobat, defaultIntocmit]
  );

  const loadSettings = useCallback(async () => {
    try {
      const settingsRef = doc(
        db,
        `Judete/${judetId}/Structuri/${structuraId}/Settings/general`
      );
      const snap = await getDoc(settingsRef);

      if (!snap.exists()) {
        const fallbackIntocmit = { nume: "" };
        const fallbackAprobat = { functia: "", grad: "", nume: "" };
        setDefaultIntocmit(fallbackIntocmit);
        setDefaultAprobat(fallbackAprobat);
        setIntocmitOptions([]);
        setAprobatOptions([]);

        if (!initializedReportRef.current) {
          const reportDate = todayYmd();
          setReportDraft({
            reportDate,
            title: buildDefaultReportTitle(reportDate),
            registrationNumber: "",
            activities: [createEmptyActivity()],
            intocmit: fallbackIntocmit,
            aprobat: fallbackAprobat,
            templateId: null,
            createdByUid: auth.currentUser?.uid || null,
            createdByEmail: auth.currentUser?.email || null,
          });
          initializedReportRef.current = true;
        }
        return;
      }

      const data = snap.data() as any;

      const headerLines = Array.isArray(data?.headerLines)
        ? data.headerLines.map((line: any) => String(line || "").trim()).filter(Boolean)
        : EMPTY_PRINT_SETTINGS.headerLines;
      const footerLines = Array.isArray(data?.footerLines)
        ? data.footerLines.map((line: any) => String(line || "").trim()).filter(Boolean)
        : EMPTY_PRINT_SETTINGS.footerLines;

      setSettingsMeta({
        headerLines: headerLines.length ? headerLines : EMPTY_PRINT_SETTINGS.headerLines,
        footerLines,
        logoUrlPublic: String(data?.logoUrlPublic || ""),
        unitLabel: String(data?.unitLabel || EMPTY_PRINT_SETTINGS.unitLabel),
        phone: String(data?.phone || ""),
        email: String(data?.email || ""),
      });

      const parsedIntocmit = Array.isArray(data?.purtatori)
        ? data.purtatori
            .map((item: any) => ({ nume: String(item?.nume || "").trim() }))
            .filter((item: IntocmitOption) => item.nume)
        : [];

      const parsedAprobat = Array.isArray(data?.semnatari)
        ? data.semnatari
            .map((item: any) => ({
              functia: String(item?.functia || "").trim(),
              grad: String(item?.grad || "").trim(),
              nume: String(item?.nume || "").trim(),
            }))
            .filter((item: AprobatOption) => item.nume)
        : [];

      const intocmitIndex =
        typeof data?.purtatorIndex === "number" ? data.purtatorIndex : 0;
      const aprobatIndex =
        typeof data?.semnatarIndex === "number" ? data.semnatarIndex : 0;

      const nextDefaultIntocmit =
        parsedIntocmit[intocmitIndex] || parsedIntocmit[0] || { nume: "" };
      const nextDefaultAprobat =
        parsedAprobat[aprobatIndex] || parsedAprobat[0] || {
          functia: "",
          grad: "",
          nume: "",
        };

      setIntocmitOptions(parsedIntocmit);
      setAprobatOptions(parsedAprobat);
      setDefaultIntocmit(nextDefaultIntocmit);
      setDefaultAprobat(nextDefaultAprobat);

      if (!initializedReportRef.current) {
        const reportDate = todayYmd();
        setReportDraft({
          reportDate,
          title: buildDefaultReportTitle(reportDate),
          registrationNumber: "",
          activities: [createEmptyActivity()],
          intocmit: nextDefaultIntocmit,
          aprobat: nextDefaultAprobat,
          templateId: null,
          createdByUid: auth.currentUser?.uid || null,
          createdByEmail: auth.currentUser?.email || null,
        });
        initializedReportRef.current = true;
      }
    } catch {
      if (!initializedReportRef.current) {
        const reportDate = todayYmd();
        setReportDraft({
          reportDate,
          title: buildDefaultReportTitle(reportDate),
          registrationNumber: "",
          activities: [createEmptyActivity()],
          intocmit: { nume: "" },
          aprobat: { functia: "", grad: "", nume: "" },
          templateId: null,
          createdByUid: auth.currentUser?.uid || null,
          createdByEmail: auth.currentUser?.email || null,
        });
        initializedReportRef.current = true;
      }
    }
  }, [auth, db, judetId, structuraId]);

  const loadReports = useCallback(async () => {
    setLoadingReports(true);
    setReportError(null);
    try {
      const coll = getDailyActivityReportsCollection(db);
      const snap = await getDocs(query(coll, orderBy("updatedAt", "desc")));
      const next = snap.docs.map((item) => normalizeReportDoc(item.data(), item.id));
      setReports(sortReportsByUpdatedAtDesc(next));
    } catch {
      setReportError("Nu am putut încărca rapoartele zilnice.");
      setReports([]);
    } finally {
      setLoadingReports(false);
    }
  }, [db]);

  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    setTemplateError(null);
    try {
      const coll = getDailyActivityTemplatesCollection(db);
      const snap = await getDocs(query(coll, orderBy("updatedAt", "desc")));
      const next = snap.docs.map((item) => normalizeTemplateDoc(item.data(), item.id));
      setTemplates(sortTemplatesByUpdatedAtDesc(next));
    } catch {
      setTemplateError("Nu am putut încărca template-urile.");
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  }, [db]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    void loadReports();
    void loadTemplates();
  }, [loadReports, loadTemplates]);

  const selectedReport = useMemo(
    () => reports.find((item) => item.id === selectedReportId) || null,
    [reports, selectedReportId]
  );

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );

  const visibleReports = useMemo(() => {
    const queryValue = searchQuery.trim().toLocaleLowerCase("ro");
    const filtered = reports.filter((report) => {
      if (!queryValue) return true;

      const fields = [
        report.title,
        report.registrationNumber || "",
        report.reportDate,
        report.intocmit.nume,
        report.aprobat.nume,
        report.aprobat.grad,
        report.aprobat.functia,
        ...report.activities.flatMap((item) => [
          item.intervalOrar,
          item.activitate,
          item.executant,
          item.observatii,
        ]),
      ];

      return fields.some((value) =>
        String(value || "").toLocaleLowerCase("ro").includes(queryValue)
      );
    });

    return [...filtered].sort((left, right) => {
      let result = 0;
      if (sortBy === "reportDate") {
        result = left.reportDate.localeCompare(right.reportDate, "ro");
      } else if (sortBy === "title") {
        result = left.title.localeCompare(right.title, "ro");
      } else if (sortBy === "activitiesCount") {
        result = left.activities.length - right.activities.length;
      } else {
        const leftTs = asTimestampMillis(left.updatedAt) || asTimestampMillis(left.createdAt);
        const rightTs = asTimestampMillis(right.updatedAt) || asTimestampMillis(right.createdAt);
        result = leftTs - rightTs;
      }

      if (result === 0) {
        const leftTs = asTimestampMillis(left.updatedAt) || asTimestampMillis(left.createdAt);
        const rightTs = asTimestampMillis(right.updatedAt) || asTimestampMillis(right.createdAt);
        result = leftTs - rightTs;
      }
      return sortDir === "asc" ? result : -result;
    });
  }, [reports, searchQuery, sortBy, sortDir]);

  const activitySuggestions = useMemo(() => {
    const set = new Set<string>();

    const collect = (value: string) => {
      const normalized = String(value || "").trim();
      if (normalized) set.add(normalized);
    };

    reports.forEach((report) => {
      report.activities.forEach((item) => collect(item.activitate));
    });

    templates.forEach((template) => {
      template.activities.forEach((item) => collect(item.activitate));
    });

    reportDraft.activities.forEach((item) => collect(item.activitate));
    templateDraft.activities.forEach((item) => collect(item.activitate));

    return Array.from(set).sort((a, b) => a.localeCompare(b, "ro"));
  }, [reportDraft.activities, reports, templateDraft.activities, templates]);

  const executantSuggestions = useMemo(() => {
    const set = new Set<string>();

    const collect = (value: string) => {
      const normalized = String(value || "").trim();
      if (normalized) set.add(normalized);
    };

    reports.forEach((report) => {
      report.activities.forEach((item) => collect(item.executant));
    });

    templates.forEach((template) => {
      template.activities.forEach((item) => collect(item.executant));
    });

    reportDraft.activities.forEach((item) => collect(item.executant));
    templateDraft.activities.forEach((item) => collect(item.executant));

    return Array.from(set).sort((a, b) => a.localeCompare(b, "ro"));
  }, [reportDraft.activities, reports, templateDraft.activities, templates]);

  const reportIntocmitValue = useMemo(() => {
    const index = intocmitOptions.findIndex(
      (item) => item.nume === reportDraft.intocmit.nume
    );
    return index >= 0 ? String(index) : "__custom__";
  }, [intocmitOptions, reportDraft.intocmit.nume]);

  const reportAprobatValue = useMemo(() => {
    const index = aprobatOptions.findIndex(
      (item) =>
        item.nume === reportDraft.aprobat.nume &&
        item.grad === reportDraft.aprobat.grad &&
        item.functia === reportDraft.aprobat.functia
    );
    return index >= 0 ? String(index) : "__custom__";
  }, [aprobatOptions, reportDraft.aprobat]);

  function applyReport(report: DailyActivityReport) {
    setSelectedReportId(report.id);
    setReportDraft({
      reportDate: report.reportDate,
      title: report.title,
      registrationNumber: report.registrationNumber || "",
      activities: cloneActivities(report.activities),
      intocmit: { ...report.intocmit },
      aprobat: { ...report.aprobat },
      templateId: report.templateId || null,
      createdByUid: report.createdByUid || null,
      createdByEmail: report.createdByEmail || null,
    });
    setReportError(null);
  }

  function startNewReport(
    template?: DailyActivityTemplate,
    options?: { switchToEditor?: boolean }
  ) {
    setSelectedReportId(NEW_REPORT_VALUE);
    setReportDraft(createNewReportDraft(template));
    setReportError(null);
    if (options?.switchToEditor !== false) {
      setTab("editor-raport");
    }
  }

  function updateReportField<K extends keyof DailyActivityReportDraft>(
    key: K,
    value: DailyActivityReportDraft[K]
  ) {
    setReportDraft((previous) => ({ ...previous, [key]: value }));
  }

  function addReportActivity() {
    setReportDraft((previous) => ({
      ...previous,
      activities: [...previous.activities, createEmptyActivity()],
    }));
  }

  function updateReportActivity(
    itemId: string,
    field: keyof DailyActivityItem,
    value: string
  ) {
    setReportDraft((previous) => ({
      ...previous,
      activities: previous.activities.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      ),
    }));
  }

  function removeReportActivity(itemId: string) {
    setReportDraft((previous) => {
      const next = previous.activities.filter((item) => item.id !== itemId);
      return {
        ...previous,
        activities: next.length ? next : [createEmptyActivity()],
      };
    });
  }

  function validateReportDraft() {
    const title = reportDraft.title.trim();
    if (!title) return "Titlul raportului este obligatoriu.";

    if (!reportDraft.reportDate) return "Data raportului este obligatorie.";

    if (!reportDraft.intocmit.nume.trim()) {
      return "Completează semnătura ÎNTOCMIT.";
    }

    if (!reportDraft.aprobat.nume.trim()) {
      return "Completează semnătura APROBAT.";
    }

    const activities = normalizeActivitiesForSave(reportDraft.activities);
    if (!activities.length) {
      return "Adaugă cel puțin o activitate în raport.";
    }

    for (const item of activities) {
      if (!item.activitate) return "Fiecare activitate trebuie să aibă descriere.";
      if (!item.executant) return "Fiecare activitate trebuie să aibă executant.";
      if (
        item.intervalOrar &&
        !/^\d{2}:\d{2}\s*-\s*\d{2}:\d{2}$/.test(item.intervalOrar)
      ) {
        return "Intervalul orar trebuie să fie în format HH:mm - HH:mm.";
      }
    }

    return null;
  }

  async function saveReport() {
    const validationError = validateReportDraft();
    if (validationError) {
      setReportError(validationError);
      return;
    }

    const cleanedActivities = normalizeActivitiesForSave(reportDraft.activities);
    const isNew = selectedReportId === NEW_REPORT_VALUE;
    const targetId = isNew ? createId() : selectedReportId;

    setSavingReport(true);
    setReportError(null);
    try {
      const coll = getDailyActivityReportsCollection(db);
      const currentUser = auth.currentUser;

      await setDoc(
        doc(coll, targetId),
        {
          reportDate: reportDraft.reportDate,
          reportTimestamp: buildReportTimestamp(reportDraft.reportDate),
          title: reportDraft.title.trim(),
          registrationNumber: reportDraft.registrationNumber?.trim() || "",
          activities: cleanedActivities,
          intocmit: {
            nume: reportDraft.intocmit.nume.trim(),
          },
          aprobat: {
            functia: reportDraft.aprobat.functia.trim(),
            grad: reportDraft.aprobat.grad.trim(),
            nume: reportDraft.aprobat.nume.trim(),
          },
          templateId: reportDraft.templateId || null,
          createdByUid:
            reportDraft.createdByUid || currentUser?.uid || null,
          createdByEmail:
            reportDraft.createdByEmail || currentUser?.email || null,
          updatedAt: serverTimestamp(),
          ...(isNew ? { createdAt: serverTimestamp() } : {}),
        },
        { merge: true }
      );

      await loadReports();

      setSelectedReportId(targetId);
      setReportDraft((previous) => ({
        ...previous,
        activities: cleanedActivities,
        title: previous.title.trim(),
        registrationNumber: previous.registrationNumber?.trim() || "",
        intocmit: { nume: previous.intocmit.nume.trim() },
        aprobat: {
          functia: previous.aprobat.functia.trim(),
          grad: previous.aprobat.grad.trim(),
          nume: previous.aprobat.nume.trim(),
        },
      }));

      setNotice("Raportul zilnic a fost salvat.");
    } catch {
      setReportError("Nu am putut salva raportul.");
    } finally {
      setSavingReport(false);
    }
  }

  async function duplicateReport() {
    const validationError = validateReportDraft();
    if (validationError) {
      setReportError(validationError);
      return;
    }

    setActionKey("duplicate-report");
    setReportError(null);
    try {
      const coll = getDailyActivityReportsCollection(db);
      const duplicateId = createId();
      const cleanedActivities = normalizeActivitiesForSave(reportDraft.activities);

      await setDoc(doc(coll, duplicateId), {
        reportDate: reportDraft.reportDate,
        reportTimestamp: buildReportTimestamp(reportDraft.reportDate),
        title: `${reportDraft.title.trim()} (copie)`,
        registrationNumber: reportDraft.registrationNumber?.trim() || "",
        activities: cloneActivities(cleanedActivities, true),
        intocmit: {
          nume: reportDraft.intocmit.nume.trim(),
        },
        aprobat: {
          functia: reportDraft.aprobat.functia.trim(),
          grad: reportDraft.aprobat.grad.trim(),
          nume: reportDraft.aprobat.nume.trim(),
        },
        templateId: reportDraft.templateId || null,
        createdByUid: auth.currentUser?.uid || null,
        createdByEmail: auth.currentUser?.email || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await loadReports();
      setSelectedReportId(duplicateId);
      setReportDraft((previous) => ({
        ...previous,
        title: `${previous.title.trim()} (copie)`,
        activities: cloneActivities(cleanedActivities, true),
      }));
      setNotice("Raport duplicat cu succes.");
    } catch {
      setReportError("Nu am putut duplica raportul.");
    } finally {
      setActionKey(null);
    }
  }

  async function deleteCurrentReport() {
    if (selectedReportId === NEW_REPORT_VALUE) {
      startNewReport();
      return;
    }

    if (!window.confirm("Ștergi raportul selectat?")) return;

    setActionKey("delete-report");
    setReportError(null);
    try {
      const coll = getDailyActivityReportsCollection(db);
      await deleteDoc(doc(coll, selectedReportId));
      await loadReports();
      startNewReport();
      setNotice("Raport șters.");
    } catch {
      setReportError("Nu am putut șterge raportul.");
    } finally {
      setActionKey(null);
    }
  }

  async function deleteReportById(reportId: string) {
    if (!window.confirm("Ștergi raportul selectat din listă?")) return;

    setActionKey(`delete-report:${reportId}`);
    setReportError(null);
    try {
      const coll = getDailyActivityReportsCollection(db);
      await deleteDoc(doc(coll, reportId));
      await loadReports();
      if (selectedReportId === reportId) {
        startNewReport(undefined, { switchToEditor: false });
      }
      setNotice("Raport șters.");
    } catch {
      setReportError("Nu am putut șterge raportul.");
    } finally {
      setActionKey(null);
    }
  }

  function updateTemplateField<K extends keyof DailyActivityTemplateDraft>(
    key: K,
    value: DailyActivityTemplateDraft[K]
  ) {
    setTemplateDraft((previous) => ({ ...previous, [key]: value }));
  }

  function applyTemplate(template: DailyActivityTemplate) {
    setSelectedTemplateId(template.id);
    setTemplateDraft({
      name: template.name,
      description: template.description || "",
      activities: cloneActivities(template.activities),
    });
    setTemplateError(null);
  }

  function startNewTemplate(fromReport = false) {
    if (fromReport) {
      setTemplateDraft({
        name: `Template ${formatDateRo(reportDraft.reportDate)}`,
        description: `Generat din raportul: ${reportDraft.title}`,
        activities: cloneActivities(reportDraft.activities, true),
      });
    } else {
      setTemplateDraft(createEmptyTemplateDraft());
    }
    setSelectedTemplateId(NEW_TEMPLATE_VALUE);
    setTemplateError(null);
    setTab("templateuri");
  }

  function addTemplateActivity() {
    setTemplateDraft((previous) => ({
      ...previous,
      activities: [...previous.activities, createEmptyActivity()],
    }));
  }

  function updateTemplateActivity(
    itemId: string,
    field: keyof DailyActivityItem,
    value: string
  ) {
    setTemplateDraft((previous) => ({
      ...previous,
      activities: previous.activities.map((item) =>
        item.id === itemId ? { ...item, [field]: value } : item
      ),
    }));
  }

  function removeTemplateActivity(itemId: string) {
    setTemplateDraft((previous) => {
      const next = previous.activities.filter((item) => item.id !== itemId);
      return {
        ...previous,
        activities: next.length ? next : [createEmptyActivity()],
      };
    });
  }

  function validateTemplateDraft() {
    const name = templateDraft.name.trim();
    if (!name) return "Numele template-ului este obligatoriu.";

    const activities = normalizeActivitiesForSave(templateDraft.activities);
    if (!activities.length) return "Template-ul trebuie să conțină activități.";

    for (const item of activities) {
      if (!item.activitate) return "Fiecare activitate trebuie să aibă descriere.";
      if (!item.executant) return "Fiecare activitate trebuie să aibă executant.";
      if (
        item.intervalOrar &&
        !/^\d{2}:\d{2}\s*-\s*\d{2}:\d{2}$/.test(item.intervalOrar)
      ) {
        return "Intervalul orar din template trebuie să fie în format HH:mm - HH:mm.";
      }
    }

    return null;
  }

  async function saveTemplate() {
    const validationError = validateTemplateDraft();
    if (validationError) {
      setTemplateError(validationError);
      return;
    }

    const cleanedActivities = normalizeActivitiesForSave(templateDraft.activities);
    const isNew = selectedTemplateId === NEW_TEMPLATE_VALUE;
    const targetId = isNew ? createId() : selectedTemplateId;

    setSavingTemplate(true);
    setTemplateError(null);
    try {
      const coll = getDailyActivityTemplatesCollection(db);
      await setDoc(
        doc(coll, targetId),
        {
          name: templateDraft.name.trim(),
          description: templateDraft.description?.trim() || "",
          activities: cleanedActivities,
          updatedAt: serverTimestamp(),
          ...(isNew ? { createdAt: serverTimestamp() } : {}),
        },
        { merge: true }
      );

      await loadTemplates();
      setSelectedTemplateId(targetId);
      setTemplateDraft((previous) => ({
        ...previous,
        name: previous.name.trim(),
        description: previous.description?.trim() || "",
        activities: cleanedActivities,
      }));
      setNotice("Template salvat.");
    } catch {
      setTemplateError("Nu am putut salva template-ul.");
    } finally {
      setSavingTemplate(false);
    }
  }

  async function duplicateTemplate() {
    const validationError = validateTemplateDraft();
    if (validationError) {
      setTemplateError(validationError);
      return;
    }

    setActionKey("duplicate-template");
    setTemplateError(null);
    try {
      const duplicateId = createId();
      const coll = getDailyActivityTemplatesCollection(db);
      const cleanedActivities = normalizeActivitiesForSave(templateDraft.activities);

      await setDoc(doc(coll, duplicateId), {
        name: `${templateDraft.name.trim()} (copie)`,
        description: templateDraft.description?.trim() || "",
        activities: cloneActivities(cleanedActivities, true),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await loadTemplates();
      setSelectedTemplateId(duplicateId);
      setTemplateDraft((previous) => ({
        ...previous,
        name: `${previous.name.trim()} (copie)`,
        activities: cloneActivities(cleanedActivities, true),
      }));
      setNotice("Template duplicat.");
    } catch {
      setTemplateError("Nu am putut duplica template-ul.");
    } finally {
      setActionKey(null);
    }
  }

  async function deleteCurrentTemplate() {
    if (selectedTemplateId === NEW_TEMPLATE_VALUE) {
      startNewTemplate();
      return;
    }

    if (!window.confirm("Ștergi template-ul selectat?")) return;

    setActionKey("delete-template");
    setTemplateError(null);
    try {
      const coll = getDailyActivityTemplatesCollection(db);
      await deleteDoc(doc(coll, selectedTemplateId));
      await loadTemplates();
      startNewTemplate();
      setNotice("Template șters.");
    } catch {
      setTemplateError("Nu am putut șterge template-ul.");
    } finally {
      setActionKey(null);
    }
  }

  async function applyTemplateToNewReport(template: DailyActivityTemplate) {
    try {
      const coll = getDailyActivityTemplatesCollection(db);
      await setDoc(
        doc(coll, template.id),
        {
          lastUsedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      void loadTemplates();
    } catch {}

    startNewReport(template);
    setNotice(`Template aplicat: ${template.name}`);
  }

  async function printReportPdfById(
    reportId: string,
    options?: { rowFeedback?: boolean }
  ) {
    if (!reportId || isPrintingPdf) return;
    const rowFeedback = options?.rowFeedback === true;

    setIsPrintingPdf(true);
    if (rowFeedback) setPrintingReportId(reportId);
    setReportError(null);

    let iframe: HTMLIFrameElement | null = null;
    try {
      const url = `/api/activitate-zilnica/${encodeURIComponent(
        reportId
      )}/pdf?disposition=inline&judetId=${encodeURIComponent(
        judetId
      )}&structuraId=${encodeURIComponent(structuraId)}`;

      iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.opacity = "0";
      iframe.style.pointerEvents = "none";
      document.body.appendChild(iframe);

      await new Promise<void>((resolve) => {
        iframe!.onload = () => resolve();
        iframe!.src = url;
      });

      const win = iframe.contentWindow;
      const afterPrintPromise = new Promise<void>((resolve) => {
        const handler = () => {
          try {
            win?.removeEventListener("afterprint", handler as any);
          } catch {}
          try {
            window.removeEventListener("focus", onFocus, { capture: true } as any);
          } catch {}
          resolve();
        };

        const onFocus = () => {
          handler();
        };

        try {
          win?.addEventListener("afterprint", handler as any);
        } catch {}
        try {
          window.addEventListener("focus", onFocus, {
            once: true,
            capture: true,
          } as any);
        } catch {}
        setTimeout(handler, 20000);
      });

      try {
        win?.focus();
      } catch {}
      try {
        win?.print();
      } catch {}
      await afterPrintPromise;
    } catch {
      setReportError("Eroare la generarea PDF-ului pentru print.");
    } finally {
      if (iframe) {
        try {
          document.body.removeChild(iframe);
        } catch {}
      }
      if (rowFeedback) setPrintingReportId(null);
      setIsPrintingPdf(false);
    }
  }

  async function onPrint() {
    if (selectedReportId === NEW_REPORT_VALUE) {
      setReportError("Salvează raportul înainte de a tipări PDF-ul.");
      setTab("editor-raport");
      return;
    }
    await printReportPdfById(selectedReportId);
  }

  function openReportInEditor(report: DailyActivityReport) {
    applyReport(report);
    setTab("editor-raport");
  }

  function toggleSort(nextSortBy: ReportSortBy) {
    setSortBy((currentSortBy) => {
      if (currentSortBy === nextSortBy) {
        setSortDir((currentSortDir) => (currentSortDir === "asc" ? "desc" : "asc"));
        return currentSortBy;
      }
      setSortDir("desc");
      return nextSortBy;
    });
  }

  async function printReportFromList(report: DailyActivityReport) {
    applyReport(report);
    await printReportPdfById(report.id, { rowFeedback: true });
  }

  return (
    <div className="space-y-6 print-wrapper">
      <style jsx global>{`
        .print-only {
          display: none;
        }

        @page {
          size: A4;
          margin: 14mm;
        }

        @media print {
          .print-only {
            display: block !important;
          }

          .print-hidden {
            display: none !important;
          }

          .print-wrapper {
            margin: 0 !important;
            padding: 0 !important;
            max-width: none !important;
          }

          .print-sheet {
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }

          body {
            background: #ffffff !important;
          }
        }
      `}</style>

      <div className="print-hidden flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-gray-900">
            <ClipboardList className="h-7 w-7 text-blue-700" />
            Activitate zilnică
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Gestionare rapoarte zilnice, template-uri reutilizabile și print A4.
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Structură activă: {judetId} / {structuraId}
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void onPrint();
          }}
          disabled={isPrintingPdf}
          className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Printer className="h-4 w-4" />
          {isPrintingPdf ? "Se pregătește..." : "Printează A4"}
        </button>
      </div>

      {notice && (
        <div className="print-hidden rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      <div className="print-hidden inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white">
        <button
          type="button"
          onClick={() => setTab("lista-rapoarte")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "lista-rapoarte"
              ? "bg-blue-600 text-white"
              : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          Lista rapoarte
        </button>
        <button
          type="button"
          onClick={() => setTab("editor-raport")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "editor-raport"
              ? "bg-blue-600 text-white"
              : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          Editor raport
        </button>
        <button
          type="button"
          onClick={() => setTab("templateuri")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "templateuri"
              ? "bg-blue-600 text-white"
              : "text-gray-700 hover:bg-gray-50"
          }`}
        >
          Template-uri
        </button>
      </div>

      {tab === "lista-rapoarte" ? (
        <div className="print-hidden space-y-4">
          <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">Bibliotecă rapoarte</div>
                <div className="text-xs text-gray-500">
                  {visibleReports.length} rezultate din {reports.length} rapoarte
                </div>
              </div>
              <button
                type="button"
                onClick={() => startNewReport()}
                className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                <Plus className="h-3 w-3" />
                Raport nou
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Caută în titlu, număr înregistrare, activitate, executant..."
                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm"
                />
              </div>

              <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white">
                <button
                  type="button"
                  onClick={() => setListViewMode("card")}
                  className={`inline-flex items-center gap-1 px-3 py-2 text-xs font-medium ${
                    listViewMode === "card"
                      ? "bg-blue-600 text-white"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Grid2X2 className="h-3.5 w-3.5" />
                  Carduri
                </button>
                <button
                  type="button"
                  onClick={() => setListViewMode("table")}
                  className={`inline-flex items-center gap-1 border-l border-gray-200 px-3 py-2 text-xs font-medium ${
                    listViewMode === "table"
                      ? "bg-blue-600 text-white"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Rows2 className="h-3.5 w-3.5" />
                  Tabel
                </button>
              </div>

              <select
                value={`${sortBy}:${sortDir}`}
                onChange={(event) => {
                  const [nextSortBy, nextSortDir] = event.target.value.split(":");
                  setSortBy(nextSortBy as ReportSortBy);
                  setSortDir(nextSortDir as SortDir);
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-xs"
              >
                <option value="updatedAt:desc">Actualizat (desc)</option>
                <option value="updatedAt:asc">Actualizat (asc)</option>
                <option value="reportDate:desc">Data raport (desc)</option>
                <option value="reportDate:asc">Data raport (asc)</option>
                <option value="title:asc">Titlu (A-Z)</option>
                <option value="title:desc">Titlu (Z-A)</option>
                <option value="activitiesCount:desc">Activități (desc)</option>
                <option value="activitiesCount:asc">Activități (asc)</option>
              </select>
            </div>
          </section>

          {reportError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {reportError}
            </div>
          )}

          {loadingReports ? (
            <section className="rounded-2xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500 shadow-sm">
              Se încarcă rapoartele...
            </section>
          ) : visibleReports.length === 0 ? (
            <section className="rounded-2xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500 shadow-sm">
              Nu există rapoarte care să corespundă filtrării curente.
            </section>
          ) : listViewMode === "card" ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {visibleReports.map((report) => (
                <article
                  key={`card:${report.id}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => openReportInEditor(report)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openReportInEditor(report);
                    }
                  }}
                  className={`rounded-2xl border p-4 text-left shadow-sm transition-colors ${
                    selectedReportId === report.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="text-sm font-semibold text-gray-900">{report.title}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {formatDateRo(report.reportDate)}
                    </span>
                    <span>{report.activities.length} activități</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    Actualizat: {formatDateTime(report.updatedAt || report.createdAt) || "-"}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1" onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => openReportInEditor(report)}
                      className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      Deschide
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void printReportFromList(report);
                      }}
                      disabled={isPrintingPdf}
                      className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                    >
                      {printingReportId === report.id ? "Se pregătește..." : "Printează"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void deleteReportById(report.id);
                      }}
                      disabled={actionKey === `delete-report:${report.id}`}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      {actionKey === `delete-report:${report.id}` ? "Se șterge..." : "Șterge"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => toggleSort("reportDate")}
                          className="inline-flex items-center gap-1"
                        >
                          Data raport
                          {sortBy === "reportDate" ? (
                            sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                          ) : null}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => toggleSort("title")}
                          className="inline-flex items-center gap-1"
                        >
                          Titlu
                          {sortBy === "title" ? (
                            sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                          ) : null}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold">Nr. înreg.</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => toggleSort("activitiesCount")}
                          className="inline-flex items-center gap-1"
                        >
                          Activități
                          {sortBy === "activitiesCount" ? (
                            sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                          ) : null}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-semibold">Întocmit</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold">Aprobat</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold">
                        <button
                          type="button"
                          onClick={() => toggleSort("updatedAt")}
                          className="inline-flex items-center gap-1"
                        >
                          Actualizat
                          {sortBy === "updatedAt" ? (
                            sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                          ) : null}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-semibold">Acțiuni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleReports.map((report) => (
                      <tr
                        key={`table:${report.id}`}
                        onClick={() => openReportInEditor(report)}
                        className={`cursor-pointer border-t border-gray-200 ${
                          selectedReportId === report.id
                            ? "bg-blue-50"
                            : "bg-white hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-3 py-2 text-xs text-gray-700">{formatDateRo(report.reportDate)}</td>
                        <td className="px-3 py-2 text-xs text-gray-900">{report.title}</td>
                        <td className="px-3 py-2 text-xs text-gray-700">{report.registrationNumber || "-"}</td>
                        <td className="px-3 py-2 text-xs text-gray-700">{report.activities.length}</td>
                        <td className="px-3 py-2 text-xs text-gray-700">{report.intocmit.nume || "-"}</td>
                        <td className="px-3 py-2 text-xs text-gray-700">
                          {[report.aprobat.grad, report.aprobat.nume].filter(Boolean).join(" ") || "-"}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {formatDateTime(report.updatedAt || report.createdAt) || "-"}
                        </td>
                        <td className="px-3 py-2 text-right" onClick={(event) => event.stopPropagation()}>
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openReportInEditor(report)}
                              className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                            >
                              Deschide
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void printReportFromList(report);
                              }}
                              disabled={isPrintingPdf}
                              className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                            >
                              {printingReportId === report.id ? "Se pregătește..." : "Printează"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void deleteReportById(report.id);
                              }}
                              disabled={actionKey === `delete-report:${report.id}`}
                              className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
                            >
                              {actionKey === `delete-report:${report.id}` ? "Se șterge..." : "Șterge"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      ) : tab === "editor-raport" ? (
        <section className="print-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
            <div className="text-sm font-semibold text-gray-900">
              {selectedReportId === NEW_REPORT_VALUE ? "Raport nou" : "Editare raport"}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setTab("lista-rapoarte")}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                <ArrowLeft className="h-3 w-3" />
                Înapoi la listă
              </button>
              <button
                type="button"
                onClick={() => startNewTemplate(true)}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                <FileStack className="h-3 w-3" />
                Salvează ca template
              </button>
              <button
                type="button"
                onClick={duplicateReport}
                disabled={actionKey === "duplicate-report"}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                <Copy className="h-3 w-3" />
                Duplică
              </button>
              <button
                type="button"
                onClick={deleteCurrentReport}
                disabled={actionKey === "delete-report"}
                className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" />
                Șterge
              </button>
              <button
                type="button"
                onClick={saveReport}
                disabled={savingReport}
                className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="h-3 w-3" />
                {savingReport ? "Se salvează..." : "Salvează"}
              </button>
            </div>
          </div>

          <div className="space-y-5 p-4">
            {reportError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {reportError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Data raport</label>
                <input
                  type="date"
                  value={reportDraft.reportDate}
                  onChange={(event) => {
                    const nextDate = event.target.value;
                    updateReportField("reportDate", nextDate);
                    if (
                      reportDraft.title.trim() ===
                      buildDefaultReportTitle(reportDraft.reportDate)
                    ) {
                      updateReportField("title", buildDefaultReportTitle(nextDate));
                    }
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Număr înregistrare</label>
                <input
                  value={reportDraft.registrationNumber || ""}
                  onChange={(event) =>
                    updateReportField("registrationNumber", event.target.value)
                  }
                  placeholder="Ex: 123/2026"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Sursă template</label>
                <input
                  value={
                    reportDraft.templateId
                      ? templates.find((item) => item.id === reportDraft.templateId)?.name ||
                        "Template selectat"
                      : "-"
                  }
                  disabled
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Titlu raport</label>
              <input
                value={reportDraft.title}
                onChange={(event) => updateReportField("title", event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">ÎNTOCMIT</label>
                {intocmitOptions.length > 0 ? (
                  <select
                    value={reportIntocmitValue}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === "__custom__") return;
                      const next = intocmitOptions[Number(value)];
                      if (!next) return;
                      updateReportField("intocmit", { nume: next.nume });
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    {reportIntocmitValue === "__custom__" && (
                      <option value="__custom__">
                        {reportDraft.intocmit.nume
                          ? `Curent: ${reportDraft.intocmit.nume}`
                          : "Selectează persoana"}
                      </option>
                    )}
                    {intocmitOptions.map((item, index) => (
                      <option key={`${item.nume}:${index}`} value={String(index)}>
                        {item.nume}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={reportDraft.intocmit.nume}
                    onChange={(event) =>
                      updateReportField("intocmit", { nume: event.target.value })
                    }
                    placeholder="Nume ÎNTOCMIT"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">APROBAT</label>
                {aprobatOptions.length > 0 ? (
                  <select
                    value={reportAprobatValue}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === "__custom__") return;
                      const next = aprobatOptions[Number(value)];
                      if (!next) return;
                      updateReportField("aprobat", {
                        functia: next.functia,
                        grad: next.grad,
                        nume: next.nume,
                      });
                    }}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    {reportAprobatValue === "__custom__" && (
                      <option value="__custom__">
                        {reportDraft.aprobat.nume
                          ? `Curent: ${reportDraft.aprobat.nume}`
                          : "Selectează persoana"}
                      </option>
                    )}
                    {aprobatOptions.map((item, index) => (
                      <option
                        key={`${item.nume}:${item.functia}:${item.grad}:${index}`}
                        value={String(index)}
                      >
                        {[item.functia, item.grad, item.nume].filter(Boolean).join(" - ")}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <input
                      value={reportDraft.aprobat.functia}
                      onChange={(event) =>
                        updateReportField("aprobat", {
                          ...reportDraft.aprobat,
                          functia: event.target.value,
                        })
                      }
                      placeholder="Funcția"
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <input
                      value={reportDraft.aprobat.grad}
                      onChange={(event) =>
                        updateReportField("aprobat", {
                          ...reportDraft.aprobat,
                          grad: event.target.value,
                        })
                      }
                      placeholder="Grad"
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <input
                      value={reportDraft.aprobat.nume}
                      onChange={(event) =>
                        updateReportField("aprobat", {
                          ...reportDraft.aprobat,
                          nume: event.target.value,
                        })
                      }
                      placeholder="Nume"
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-700">Activități zilnice</label>
                <button
                  type="button"
                  onClick={addReportActivity}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                >
                  <Plus className="h-3 w-3" />
                  Adaugă activitate
                </button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-semibold">Interval orar</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold">Activitate</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold">Executant</th>
                      <th className="px-2 py-2 text-left text-xs font-semibold">Observații</th>
                      <th className="px-2 py-2 text-right text-xs font-semibold">Acțiuni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportDraft.activities.map((item) => (
                      <tr key={item.id} className="border-t border-gray-200">
                        <td className="px-2 py-2 align-top">
                          <input
                            value={item.intervalOrar}
                            onChange={(event) =>
                              updateReportActivity(item.id, "intervalOrar", event.target.value)
                            }
                            className="w-36 rounded-md border border-gray-300 px-2 py-1 text-sm"
                            placeholder="08:00 - 10:00"
                          />
                        </td>
                        <td className="px-2 py-2 align-top">
                          <input
                            value={item.activitate}
                            list="activity-suggestions"
                            onChange={(event) =>
                              updateReportActivity(
                                item.id,
                                "activitate",
                                event.target.value
                              )
                            }
                            className="w-full min-w-[220px] rounded-md border border-gray-300 px-2 py-1 text-sm"
                            placeholder="Descriere activitate"
                          />
                        </td>
                        <td className="px-2 py-2 align-top">
                          <input
                            value={item.executant}
                            list="executant-suggestions"
                            onChange={(event) =>
                              updateReportActivity(
                                item.id,
                                "executant",
                                event.target.value
                              )
                            }
                            className="w-full min-w-[220px] rounded-md border border-gray-300 px-2 py-1 text-sm"
                            placeholder="Nume executant"
                          />
                        </td>
                        <td className="px-2 py-2 align-top">
                          <textarea
                            value={item.observatii}
                            onChange={(event) =>
                              updateReportActivity(
                                item.id,
                                "observatii",
                                event.target.value
                              )
                            }
                            className="min-h-[36px] w-full min-w-[220px] rounded-md border border-gray-300 px-2 py-1 text-sm"
                            placeholder="Observații"
                          />
                        </td>
                        <td className="px-2 py-2 text-right align-top">
                          <button
                            type="button"
                            onClick={() => removeReportActivity(item.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3 w-3" />
                            Șterge
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <div className="print-hidden grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div className="text-sm font-semibold text-gray-900">Template-uri</div>
              <button
                type="button"
                onClick={() => startNewTemplate()}
                className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
              >
                <Plus className="h-3 w-3" />
                Nou
              </button>
            </div>

            <div className="max-h-[560px] overflow-auto p-3">
              {loadingTemplates ? (
                <div className="text-sm text-gray-500">Se încarcă template-urile...</div>
              ) : templates.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 px-3 py-4 text-sm text-gray-500">
                  Nu există template-uri salvate.
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className={`rounded-lg border px-3 py-3 ${
                        selectedTemplateId === template.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => applyTemplate(template)}
                        className="w-full text-left"
                      >
                        <div className="text-sm font-semibold text-gray-900">{template.name}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          {template.activities.length} activități
                        </div>
                      </button>

                      <div className="mt-2 flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => applyTemplateToNewReport(template)}
                          className="rounded-md border border-emerald-200 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
                        >
                          Raport nou din template
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-4 py-3">
              <div className="text-sm font-semibold text-gray-900">
                {selectedTemplateId === NEW_TEMPLATE_VALUE
                  ? "Template nou"
                  : "Editare template"}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={duplicateTemplate}
                  disabled={actionKey === "duplicate-template"}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  <Copy className="h-3 w-3" />
                  Duplică
                </button>
                <button
                  type="button"
                  onClick={deleteCurrentTemplate}
                  disabled={actionKey === "delete-template"}
                  className="inline-flex items-center gap-1 rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                  Șterge
                </button>
                <button
                  type="button"
                  onClick={saveTemplate}
                  disabled={savingTemplate}
                  className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save className="h-3 w-3" />
                  {savingTemplate ? "Se salvează..." : "Salvează"}
                </button>
              </div>
            </div>

            <div className="space-y-5 p-4">
              {templateError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {templateError}
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Nume template</label>
                <input
                  value={templateDraft.name}
                  onChange={(event) => updateTemplateField("name", event.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Descriere</label>
                <textarea
                  value={templateDraft.description || ""}
                  onChange={(event) =>
                    updateTemplateField("description", event.target.value)
                  }
                  className="min-h-[64px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-700">Activități template</label>
                  <button
                    type="button"
                    onClick={addTemplateActivity}
                    className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    <Plus className="h-3 w-3" />
                    Adaugă activitate
                  </button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-700">
                      <tr>
                        <th className="px-2 py-2 text-left text-xs font-semibold">Interval orar</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold">Activitate</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold">Executant</th>
                        <th className="px-2 py-2 text-left text-xs font-semibold">Observații</th>
                        <th className="px-2 py-2 text-right text-xs font-semibold">Acțiuni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {templateDraft.activities.map((item) => (
                        <tr key={item.id} className="border-t border-gray-200">
                          <td className="px-2 py-2 align-top">
                            <input
                              value={item.intervalOrar}
                              onChange={(event) =>
                                updateTemplateActivity(item.id, "intervalOrar", event.target.value)
                              }
                              className="w-36 rounded-md border border-gray-300 px-2 py-1 text-sm"
                              placeholder="08:00 - 10:00"
                            />
                          </td>
                          <td className="px-2 py-2 align-top">
                            <input
                              value={item.activitate}
                              list="activity-suggestions"
                              onChange={(event) =>
                                updateTemplateActivity(
                                  item.id,
                                  "activitate",
                                  event.target.value
                                )
                              }
                              className="w-full min-w-[220px] rounded-md border border-gray-300 px-2 py-1 text-sm"
                              placeholder="Descriere activitate"
                            />
                          </td>
                          <td className="px-2 py-2 align-top">
                            <input
                              value={item.executant}
                              list="executant-suggestions"
                              onChange={(event) =>
                                updateTemplateActivity(
                                  item.id,
                                  "executant",
                                  event.target.value
                                )
                              }
                              className="w-full min-w-[220px] rounded-md border border-gray-300 px-2 py-1 text-sm"
                              placeholder="Nume executant"
                            />
                          </td>
                          <td className="px-2 py-2 align-top">
                            <textarea
                              value={item.observatii}
                              onChange={(event) =>
                                updateTemplateActivity(
                                  item.id,
                                  "observatii",
                                  event.target.value
                                )
                              }
                              className="min-h-[36px] w-full min-w-[220px] rounded-md border border-gray-300 px-2 py-1 text-sm"
                              placeholder="Observații"
                            />
                          </td>
                          <td className="px-2 py-2 text-right align-top">
                            <button
                              type="button"
                              onClick={() => removeTemplateActivity(item.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3" />
                              Șterge
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      <datalist id="activity-suggestions">
        {activitySuggestions.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>

      <datalist id="executant-suggestions">
        {executantSuggestions.map((item) => (
          <option key={item} value={item} />
        ))}
      </datalist>

      <section className="print-only print-sheet rounded-2xl border border-gray-200 bg-white px-[78px] pb-[110px] pt-[54px] shadow-sm">
        <header className="border-b border-gray-300 pb-4">
          <div className="flex items-start gap-3">
            {settingsMeta.logoUrlPublic ? (
              <img
                src={settingsMeta.logoUrlPublic}
                alt="Siglă"
                className="h-[84px] w-[84px] shrink-0 object-contain"
              />
            ) : (
              <div className="h-[84px] w-[84px] shrink-0" />
            )}
            <div className="flex-1 text-center">
              {settingsMeta.headerLines.map((line, index) => (
                <div
                  key={`${line}:${index}`}
                  className="my-[1.5px] text-[11.5px] font-bold leading-tight text-gray-900"
                >
                  {line}
                </div>
              ))}
              <div className="mt-1 text-[10.5px] font-bold italic text-gray-800">
                {settingsMeta.unitLabel}
              </div>
              <div className="mt-2 text-[11px] font-bold text-gray-900">
                Nr. {reportDraft.registrationNumber || "____"} din{" "}
                {formatDateRo(reportDraft.reportDate)}
              </div>
            </div>
            <div className="w-[180px] shrink-0 pt-1 text-center">
              <div className="text-[10px] font-bold uppercase text-gray-900">APROB</div>
              <div className="mt-1 whitespace-pre-line text-[10px] font-semibold text-gray-800">
                {reportDraft.aprobat.functia || " "}
              </div>
              <div className="mt-2 text-[10px] font-semibold text-gray-900">
                {[reportDraft.aprobat.grad, reportDraft.aprobat.nume]
                  .filter(Boolean)
                  .join(" ") || " "}
              </div>
            </div>
          </div>
        </header>

        <div className="mt-6">
          <h2 className="text-center text-[28px] font-bold uppercase tracking-[0.28em] text-blue-600">
            ACTIVITATE ZILNICĂ
          </h2>
          <p className="mt-2 text-center text-[11px] font-semibold text-gray-800">
            {reportDraft.title || "Raport activitate zilnică"}
          </p>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full border border-gray-300 text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-2 py-2 text-left text-[11px] font-bold">Interval orar</th>
                <th className="border border-gray-300 px-2 py-2 text-left text-[11px] font-bold">Activitate</th>
                <th className="border border-gray-300 px-2 py-2 text-left text-[11px] font-bold">Executant</th>
                <th className="border border-gray-300 px-2 py-2 text-left text-[11px] font-bold">Observații</th>
              </tr>
            </thead>
            <tbody>
              {normalizeActivitiesForSave(reportDraft.activities).length === 0 ? (
                <tr>
                  <td
                    className="border border-gray-300 px-2 py-4 text-center text-[11px] text-gray-500"
                    colSpan={4}
                  >
                    Nu există activități completate.
                  </td>
                </tr>
              ) : (
                normalizeActivitiesForSave(reportDraft.activities).map((item) => (
                  <tr key={`print:${item.id}`}>
                    <td className="border border-gray-300 px-2 py-2 align-top text-[10.8px]">{item.intervalOrar || "-"}</td>
                    <td className="border border-gray-300 px-2 py-2 align-top text-[10.8px]">{item.activitate || "-"}</td>
                    <td className="border border-gray-300 px-2 py-2 align-top text-[10.8px]">{item.executant || "-"}</td>
                    <td className="border border-gray-300 px-2 py-2 align-top text-[10.8px]">{item.observatii || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="mt-12 flex items-start justify-start">
          <div className="w-[48%] text-center">
            <div className="text-[10.5px] font-bold text-gray-900">ÎNTOCMIT</div>
            <div className="mt-10 border-t border-gray-700 pt-2 text-[10px] font-semibold text-gray-900">
              {reportDraft.intocmit.nume || "-"}
            </div>
          </div>
        </footer>

        <div className="mt-8 h-2 w-full overflow-hidden">
          <div className="grid h-full grid-cols-3">
            <div className="bg-[#002B7F]" />
            <div className="bg-[#FCD116]" />
            <div className="bg-[#CE1126]" />
          </div>
        </div>
        {settingsMeta.footerLines.length > 0 ? (
          <div className="mt-3 space-y-1 text-center">
            {settingsMeta.footerLines.map((line, index) => (
              <div key={`${line}:${index}`} className="text-[10px] text-gray-700">
                {line}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {(reportError || templateError) && (
        <div className="print-hidden rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {reportError || templateError}
        </div>
      )}

      {selectedReport && (
        <div className="print-hidden rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600">
          Raport încărcat: <strong>{selectedReport.title}</strong> · creat de {selectedReport.createdByEmail || "-"}
        </div>
      )}

      {selectedTemplate && tab === "templateuri" && (
        <div className="print-hidden rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600">
          Template încărcat: <strong>{selectedTemplate.name}</strong>
        </div>
      )}
    </div>
  );
}
