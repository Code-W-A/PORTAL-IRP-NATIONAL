"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Copy,
  Download,
  MoreHorizontal,
  Plus,
  RefreshCcw,
  Trash2,
} from "lucide-react";
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

import ReportShell from "@/app/(admin-irp)/dashboard/raportari/ReportShell";
import {
  createColumnId,
  createId,
  getReportTypesCollection,
  getReportsCollection,
  normalizeReportDoc,
  normalizeTypeDoc,
  sortColumns,
} from "@/app/(admin-irp)/dashboard/raportari/_core/firestore";
import { reportExportSchema, reportInstanceSchema, reportTypeSchema } from "@/app/(admin-irp)/dashboard/raportari/_core/schema";
import { getDefaultCustomRange, isPeriodRangeValid, resolvePeriodFromPreset } from "@/app/(admin-irp)/dashboard/raportari/_core/period";
import { buildAutoReportTitle, formatDateRo, safeFilename } from "@/app/(admin-irp)/dashboard/raportari/_core/title";
import type {
  PeriodPreset,
  ReportInstanceDoc,
  ReportRowDoc,
  ReportSettingsStatus,
  ReportTypeColumn,
  ReportTypeDoc,
} from "@/app/(admin-irp)/dashboard/raportari/_core/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { initFirebase } from "@/lib/firebase";

type ToastState = {
  type: "success" | "error" | "info";
  message: string;
} | null;

type TypeDraft = {
  name: string;
  description: string;
  columns: ReportTypeColumn[];
};

type ReportDraft = Omit<ReportInstanceDoc, "id" | "createdAt" | "updatedAt">;

const TOAST_DURATION_MS = 4200;
const NEW_REPORT_VALUE = "__new__";
const NEW_TYPE_VALUE = "__new_type__";
const MAX_COLUMNS = 12;

function defaultTypeDraft(): TypeDraft {
  return {
    name: "",
    description: "",
    columns: [
      {
        id: createColumnId("coloana"),
        label: "",
        kind: "text",
        width: "m",
        required: false,
        order: 0,
      },
    ],
  };
}

function cloneTypeAsDraft(type: ReportTypeDoc | null | undefined): TypeDraft {
  if (!type) return defaultTypeDraft();
  return {
    name: type.name,
    description: type.description,
    columns: sortColumns(type.columns).map((column, index) => ({
      ...column,
      order: index,
    })),
  };
}

function normalizeTypeDraft(draft: TypeDraft): TypeDraft {
  const columns = draft.columns.map((column, index) => ({
    id: String(column.id || createColumnId(column.label || `coloana-${index + 1}`)),
    label: String(column.label || "").trim(),
    kind: column.kind,
    width: column.width,
    required: Boolean(column.required),
    order: index,
  }));
  return {
    name: draft.name.trim(),
    description: draft.description.trim(),
    columns,
  };
}

function serializeTypeDraft(draft: TypeDraft) {
  return JSON.stringify(normalizeTypeDraft(draft));
}

function normalizeReportDraft(draft: ReportDraft): ReportDraft {
  const columns = sortColumns(draft.columnsSnapshot).map((column, index) => ({
    ...column,
    label: column.label.trim(),
    order: index,
  }));

  const rows = draft.rows.map((row) => {
    const cells: Record<string, string> = {};
    columns.forEach((column) => {
      cells[column.id] = String(row.cells[column.id] || "").trim();
    });
    return {
      id: String(row.id || createId()),
      cells,
    } satisfies ReportRowDoc;
  });

  return {
    ...draft,
    typeNameSnapshot: draft.typeNameSnapshot.trim(),
    typeDescriptionSnapshot: draft.typeDescriptionSnapshot.trim(),
    title: draft.title.trim(),
    registrationNumber: draft.registrationNumber.trim(),
    periodStart: draft.periodStart,
    periodEnd: draft.periodEnd,
    columnsSnapshot: columns,
    rows,
  };
}

function serializeReportDraft(draft: ReportDraft) {
  return JSON.stringify(normalizeReportDraft(draft));
}

function formatFirestoreTimestamp(value: any) {
  try {
    if (value?.toDate) {
      const date = value.toDate();
      return `${formatDateRo(date.toISOString().slice(0, 10))} ${date.toTimeString().slice(0, 5)}`;
    }
    if (typeof value === "string") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return `${formatDateRo(date.toISOString().slice(0, 10))} ${date.toTimeString().slice(0, 5)}`;
      }
    }
  } catch {}
  return "";
}

function getReportStatus(isDirty: boolean, selectedReportId: string): "draft" | "saved" | "modified" {
  if (isDirty) return "modified";
  if (selectedReportId === NEW_REPORT_VALUE) return "draft";
  return "saved";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

function buildDraftFromType(type: ReportTypeDoc, preset: PeriodPreset, custom?: { start: string; end: string }): ReportDraft {
  const period = resolvePeriodFromPreset(preset, custom);
  return {
    typeId: type.id,
    typeNameSnapshot: type.name,
    typeDescriptionSnapshot: type.description,
    columnsSnapshot: sortColumns(type.columns).map((column, index) => ({
      ...column,
      order: index,
    })),
    title: buildAutoReportTitle(type.name, period.start, period.end),
    registrationNumber: "",
    periodPreset: preset,
    periodStart: period.start,
    periodEnd: period.end,
    rows: [],
  };
}

function validateRow(cells: Record<string, string>, columns: ReportTypeColumn[]) {
  for (const column of columns) {
    if (!column.required) continue;
    if (!String(cells[column.id] || "").trim()) {
      return `Coloana \"${column.label}\" este obligatorie.`;
    }
  }
  return null;
}

async function getAuthTokenOrThrow() {
  const { auth } = initFirebase();
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Autentificarea este necesară.");
  }
  return token;
}

export default function RaportariClient() {
  const [activeTab, setActiveTab] = useState<"reports" | "types">("reports");

  const [types, setTypes] = useState<ReportTypeDoc[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [typeError, setTypeError] = useState<string | null>(null);
  const [typeSearch, setTypeSearch] = useState("");
  const [selectedTypeId, setSelectedTypeId] = useState(NEW_TYPE_VALUE);
  const [activeReportTypeId, setActiveReportTypeId] = useState("");
  const [typeDraft, setTypeDraft] = useState<TypeDraft>(defaultTypeDraft());
  const [typeSnapshot, setTypeSnapshot] = useState(serializeTypeDraft(defaultTypeDraft()));
  const [typeSaving, setTypeSaving] = useState(false);
  const [typeActionKey, setTypeActionKey] = useState<string | null>(null);

  const [reportDraft, setReportDraft] = useState<ReportDraft | null>(null);
  const [selectedReportId, setSelectedReportId] = useState(NEW_REPORT_VALUE);
  const [reportSnapshot, setReportSnapshot] = useState("");
  const [titleAutoMode, setTitleAutoMode] = useState(false);

  const defaultCustomPeriod = useMemo(() => getDefaultCustomRange(), []);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newTypeId, setNewTypeId] = useState("");
  const [newPeriodPreset, setNewPeriodPreset] = useState<PeriodPreset>("previous_month");
  const [newCustomStart, setNewCustomStart] = useState(defaultCustomPeriod.start);
  const [newCustomEnd, setNewCustomEnd] = useState(defaultCustomPeriod.end);

  const [rowSheetOpen, setRowSheetOpen] = useState(false);
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [rowDraftCells, setRowDraftCells] = useState<Record<string, string>>({});
  const [rowError, setRowError] = useState<string | null>(null);

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [savedReports, setSavedReports] = useState<ReportInstanceDoc[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [loadingSelectedReport, setLoadingSelectedReport] = useState(false);
  const [libraryActionKey, setLibraryActionKey] = useState<string | null>(null);

  const [savingReport, setSavingReport] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [includeSignatures, setIncludeSignatures] = useState(true);
  const [settingsStatus, setSettingsStatus] = useState<ReportSettingsStatus | null>(null);

  const [reportError, setReportError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeTypes = useMemo(() => types.filter((item) => !item.archived), [types]);
  const activeType = useMemo(
    () => activeTypes.find((item) => item.id === activeReportTypeId) ?? activeTypes[0],
    [activeReportTypeId, activeTypes]
  );

  const selectedType = useMemo(() => {
    if (selectedTypeId === NEW_TYPE_VALUE) return null;
    return types.find((item) => item.id === selectedTypeId) ?? null;
  }, [selectedTypeId, types]);

  const typeDirty = useMemo(
    () => serializeTypeDraft(typeDraft) !== typeSnapshot,
    [typeDraft, typeSnapshot]
  );

  const currentReportSnapshot = useMemo(
    () => (reportDraft ? serializeReportDraft(reportDraft) : ""),
    [reportDraft]
  );
  const reportDirty = Boolean(reportDraft && currentReportSnapshot !== reportSnapshot);
  const reportStatus = getReportStatus(reportDirty, selectedReportId);
  const reportColumns = useMemo(
    () => (reportDraft ? sortColumns(reportDraft.columnsSnapshot) : []),
    [reportDraft]
  );

  const filteredTypes = useMemo(() => {
    const queryValue = typeSearch.trim().toLowerCase();
    const list = activeTypes;
    if (!queryValue) return list;
    return list.filter((item) => {
      const label = `${item.name} ${item.description}`.toLowerCase();
      return label.includes(queryValue);
    });
  }, [activeTypes, typeSearch]);

  const libraryReports = useMemo(() => {
    const queryValue = libraryQuery.trim().toLowerCase();
    if (!queryValue) return savedReports;
    return savedReports.filter((report) => {
      const label = `${report.title} ${report.registrationNumber} ${report.periodStart} ${report.periodEnd}`.toLowerCase();
      return label.includes(queryValue);
    });
  }, [libraryQuery, savedReports]);

  const showToast = useCallback((message: string, type: NonNullable<ToastState>["type"]) => {
    setToast({ message, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const loadTypes = useCallback(async () => {
    setLoadingTypes(true);
    setTypeError(null);
    try {
      const { db } = initFirebase();
      const coll = getReportTypesCollection(db);
      const snap = await getDocs(query(coll, orderBy("updatedAt", "desc")));
      const next = snap.docs.map((typeDoc) => normalizeTypeDoc(typeDoc.data(), typeDoc.id));
      setTypes(next);
    } catch {
      setTypeError("Nu am putut încărca tipurile de raportare.");
    } finally {
      setLoadingTypes(false);
    }
  }, []);

  const loadSavedReports = useCallback(async () => {
    setLoadingReports(true);
    try {
      const { db } = initFirebase();
      const coll = getReportsCollection(db);
      const snap = await getDocs(query(coll, orderBy("updatedAt", "desc")));
      const next = snap.docs.map((reportDoc) => normalizeReportDoc(reportDoc.data(), reportDoc.id));
      setSavedReports(next);
    } catch {
      setReportError("Nu am putut încărca biblioteca de raportări.");
    } finally {
      setLoadingReports(false);
    }
  }, []);

  useEffect(() => {
    void loadTypes();
    void loadSavedReports();
  }, [loadSavedReports, loadTypes]);

  useEffect(() => {
    if (!activeTypes.length) {
      setActiveReportTypeId("");
      setNewTypeId("");
      return;
    }
    if (!activeTypes.some((item) => item.id === activeReportTypeId)) {
      setActiveReportTypeId(activeTypes[0].id);
    }
    if (!activeTypes.some((item) => item.id === newTypeId)) {
      setNewTypeId(activeTypes[0].id);
    }
  }, [activeReportTypeId, activeTypes, newTypeId]);

  useEffect(() => {
    const selectableTypes = types.filter((item) => !item.archived);
    if (!selectableTypes.length) {
      setSelectedTypeId(NEW_TYPE_VALUE);
      return;
    }
    if (selectedTypeId === NEW_TYPE_VALUE) return;
    if (!selectableTypes.some((item) => item.id === selectedTypeId)) {
      setSelectedTypeId(selectableTypes[0].id);
    }
  }, [selectedTypeId, types]);

  useEffect(() => {
    const next = cloneTypeAsDraft(selectedType);
    setTypeDraft(next);
    setTypeSnapshot(serializeTypeDraft(next));
  }, [selectedType]);

  useEffect(() => {
    if (reportDraft || !activeType) return;
    const initial = buildDraftFromType(activeType, "previous_month");
    setReportDraft(initial);
    setSelectedReportId(NEW_REPORT_VALUE);
    setReportSnapshot(serializeReportDraft(initial));
    setTitleAutoMode(true);
  }, [activeType, reportDraft]);

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

  function confirmDiscardIfDirty(message = "Există modificări nesalvate. Continui?") {
    if (!reportDirty) return true;
    return window.confirm(message);
  }

  function confirmDiscardTypeIfDirty(message = "Există modificări nesalvate în tipul curent. Continui?") {
    if (!typeDirty) return true;
    return window.confirm(message);
  }

  function applyDraft(draft: ReportDraft, nextSelectedId = NEW_REPORT_VALUE, autoTitle = true) {
    const normalized = normalizeReportDraft(draft);
    setReportDraft(normalized);
    setSelectedReportId(nextSelectedId);
    setReportSnapshot(serializeReportDraft(normalized));
    setTitleAutoMode(autoTitle);
    setReportError(null);
  }

  function handleCreateReportClick() {
    if (!activeTypes.length) {
      showToast("Creează mai întâi un tip de raportare.", "info");
      setActiveTab("types");
      return;
    }
    setNewTypeId(activeReportTypeId || activeTypes[0].id);
    setNewPeriodPreset("previous_month");
    const custom = getDefaultCustomRange();
    setNewCustomStart(custom.start);
    setNewCustomEnd(custom.end);
    setNewDialogOpen(true);
  }

  function handleApplyNewReport() {
    const type = activeTypes.find((item) => item.id === newTypeId);
    if (!type) return;
    if (!confirmDiscardIfDirty("Există modificări nesalvate. Creezi un raport nou?")) return;

    const customRange = { start: newCustomStart, end: newCustomEnd };
    if (newPeriodPreset === "custom" && !isPeriodRangeValid(customRange.start, customRange.end)) {
      setReportError("Perioada custom este invalidă.");
      return;
    }

    const next = buildDraftFromType(type, newPeriodPreset, customRange);
    applyDraft(next, NEW_REPORT_VALUE, true);
    setNewDialogOpen(false);
    showToast("Raport nou inițializat.", "info");
  }

  function handleSelectTypeForReport(typeId: string) {
    setActiveReportTypeId(typeId);
  }

  function handleSelectTypeForEdit(typeId: string) {
    if (typeId === selectedTypeId) return;
    if (!confirmDiscardTypeIfDirty()) return;
    setSelectedTypeId(typeId);
  }

  function updateTypeColumn(index: number, patch: Partial<ReportTypeColumn>) {
    setTypeDraft((previous) => {
      const nextColumns = [...previous.columns];
      const target = nextColumns[index];
      if (!target) return previous;
      nextColumns[index] = { ...target, ...patch };
      return { ...previous, columns: nextColumns };
    });
  }

  function addTypeColumn() {
    setTypeDraft((previous) => {
      if (previous.columns.length >= MAX_COLUMNS) return previous;
      const nextIndex = previous.columns.length;
      return {
        ...previous,
        columns: [
          ...previous.columns,
          {
            id: createColumnId(`coloana-${nextIndex + 1}`),
            label: "",
            kind: "text",
            width: "m",
            required: false,
            order: nextIndex,
          },
        ],
      };
    });
  }

  function removeTypeColumn(index: number) {
    setTypeDraft((previous) => {
      if (previous.columns.length <= 1) return previous;
      const nextColumns = previous.columns.filter((_, i) => i !== index).map((column, idx) => ({
        ...column,
        order: idx,
      }));
      return { ...previous, columns: nextColumns };
    });
  }

  function moveTypeColumn(index: number, direction: "up" | "down") {
    setTypeDraft((previous) => {
      const nextColumns = [...previous.columns];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= nextColumns.length) return previous;
      const temp = nextColumns[index];
      nextColumns[index] = nextColumns[targetIndex];
      nextColumns[targetIndex] = temp;
      return {
        ...previous,
        columns: nextColumns.map((column, idx) => ({ ...column, order: idx })),
      };
    });
  }

  async function saveTypeDraft() {
    setTypeSaving(true);
    setTypeError(null);
    try {
      const { db } = initFirebase();
      const coll = getReportTypesCollection(db);
      const normalized = normalizeTypeDraft(typeDraft);
      const isNewType = selectedTypeId === NEW_TYPE_VALUE;
      const payload = reportTypeSchema.parse({
        ...normalized,
        id: isNewType ? undefined : selectedTypeId,
        archived: false,
      });
      const targetId = isNewType ? createId() : selectedTypeId;
      await setDoc(
        doc(coll, targetId),
        {
          ...payload,
          id: targetId,
          archived: false,
          updatedAt: serverTimestamp(),
          ...(isNewType ? { createdAt: serverTimestamp() } : {}),
        },
        { merge: true }
      );
      await loadTypes();
      setSelectedTypeId(targetId);
      setActiveReportTypeId((current) => current || targetId);
      showToast("Tipul de raportare a fost salvat.", "success");
    } catch (error: any) {
      if (error?.issues?.[0]?.message) {
        setTypeError(String(error.issues[0].message));
      } else {
        setTypeError("Nu am putut salva tipul de raportare.");
      }
    } finally {
      setTypeSaving(false);
    }
  }

  async function duplicateType() {
    if (!selectedType) return;
    setTypeActionKey("duplicate");
    try {
      const { db } = initFirebase();
      const coll = getReportTypesCollection(db);
      const cloned = normalizeTypeDraft(cloneTypeAsDraft(selectedType));
      const duplicateId = createId();
      await setDoc(doc(coll, duplicateId), {
        ...cloned,
        id: duplicateId,
        name: `${cloned.name} (copie)`,
        columns: cloned.columns.map((column, index) => ({
          ...column,
          id: createColumnId(column.label || `coloana-${index + 1}`),
          order: index,
        })),
        archived: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await loadTypes();
      setSelectedTypeId(duplicateId);
      showToast("Tipul a fost duplicat.", "success");
    } catch {
      setTypeError("Nu am putut duplica tipul.");
    } finally {
      setTypeActionKey(null);
    }
  }

  async function archiveType() {
    if (!selectedType) return;
    if (!window.confirm("Arhivezi tipul selectat?")) return;
    setTypeActionKey("archive");
    try {
      const { db } = initFirebase();
      const coll = getReportTypesCollection(db);
      await setDoc(
        doc(coll, selectedType.id),
        {
          archived: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await loadTypes();
      showToast("Tipul a fost arhivat.", "success");
    } catch {
      setTypeError("Nu am putut arhiva tipul.");
    } finally {
      setTypeActionKey(null);
    }
  }

  function createNewType() {
    if (!confirmDiscardTypeIfDirty("Există modificări nesalvate. Creezi tip nou?")) return;
    const next = defaultTypeDraft();
    setSelectedTypeId(NEW_TYPE_VALUE);
    setTypeDraft(next);
    setTypeSnapshot(serializeTypeDraft(next));
  }

  function updateReportDraft(nextUpdater: (previous: ReportDraft) => ReportDraft) {
    setReportDraft((previous) => {
      if (!previous) return previous;
      const next = nextUpdater(previous);
      if (titleAutoMode) {
        next.title = buildAutoReportTitle(next.typeNameSnapshot, next.periodStart, next.periodEnd);
      }
      return next;
    });
  }

  function handlePeriodPresetChange(preset: PeriodPreset) {
    updateReportDraft((previous) => {
      const period =
        preset === "custom"
          ? {
              start: previous.periodStart,
              end: previous.periodEnd,
            }
          : resolvePeriodFromPreset(preset);

      return {
        ...previous,
        periodPreset: preset,
        periodStart: period.start,
        periodEnd: period.end,
      };
    });
  }

  function handleCustomPeriodChange(field: "start" | "end", value: string) {
    updateReportDraft((previous) => ({
      ...previous,
      periodPreset: "custom",
      periodStart: field === "start" ? value : previous.periodStart,
      periodEnd: field === "end" ? value : previous.periodEnd,
    }));
  }

  function openAddRowSheet() {
    if (!reportDraft) return;
    const cells: Record<string, string> = {};
    reportColumns.forEach((column) => {
      cells[column.id] = "";
    });
    setRowDraftCells(cells);
    setEditingRowIndex(null);
    setRowError(null);
    setRowSheetOpen(true);
  }

  function openEditRowSheet(index: number) {
    if (!reportDraft) return;
    const row = reportDraft.rows[index];
    if (!row) return;
    const cells: Record<string, string> = {};
    reportColumns.forEach((column) => {
      cells[column.id] = String(row.cells[column.id] || "");
    });
    setRowDraftCells(cells);
    setEditingRowIndex(index);
    setRowError(null);
    setRowSheetOpen(true);
  }

  function saveRowDraft() {
    if (!reportDraft) return;
    const validationError = validateRow(rowDraftCells, reportColumns);
    if (validationError) {
      setRowError(validationError);
      return;
    }

    setReportDraft((previous) => {
      if (!previous) return previous;
      const normalizedCells: Record<string, string> = {};
      reportColumns.forEach((column) => {
        normalizedCells[column.id] = String(rowDraftCells[column.id] || "").trim();
      });

      const payload: ReportRowDoc = {
        id:
          editingRowIndex !== null && previous.rows[editingRowIndex]
            ? previous.rows[editingRowIndex].id
            : createId(),
        cells: normalizedCells,
      };

      if (editingRowIndex !== null) {
        const nextRows = [...previous.rows];
        nextRows[editingRowIndex] = payload;
        return { ...previous, rows: nextRows };
      }
      return { ...previous, rows: [...previous.rows, payload] };
    });

    setRowSheetOpen(false);
    setEditingRowIndex(null);
    setRowError(null);
  }

  function removeRow(index: number) {
    if (!window.confirm("Ștergi acest rând?")) return;
    setReportDraft((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        rows: previous.rows.filter((_, rowIndex) => rowIndex !== index),
      };
    });
  }

  async function getReportPayloadById(reportId: string, fallback?: ReportInstanceDoc): Promise<ReportDraft> {
    if (fallback) {
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = fallback;
      return normalizeReportDraft(rest);
    }

    const { db } = initFirebase();
    const coll = getReportsCollection(db);
    const snap = await getDoc(doc(coll, reportId));
    if (!snap.exists()) {
      throw new Error("missing_report");
    }
    const normalized = normalizeReportDoc(snap.data(), snap.id);
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = normalized;
    return normalizeReportDraft(rest);
  }

  async function loadReport(reportId: string, fallback?: ReportInstanceDoc) {
    if (!confirmDiscardIfDirty("Există modificări nesalvate. Încarci raportarea selectată?")) return;
    setLibraryActionKey(`load:${reportId}`);
    setLoadingSelectedReport(true);
    setReportError(null);
    try {
      const payload = await getReportPayloadById(reportId, fallback);
      applyDraft(payload, reportId, false);
      setLibraryOpen(false);
      showToast("Raportare încărcată.", "success");
    } catch {
      setReportError("Nu am putut încărca raportarea selectată.");
    } finally {
      setLibraryActionKey(null);
      setLoadingSelectedReport(false);
    }
  }

  async function renameReport(report: ReportInstanceDoc) {
    const suggested = report.title || "Raport";
    const newName = window.prompt("Titlu nou pentru raport:", suggested)?.trim();
    if (!newName || newName === suggested) return;

    setLibraryActionKey(`rename:${report.id}`);
    setReportError(null);
    try {
      const { db } = initFirebase();
      const coll = getReportsCollection(db);
      await setDoc(
        doc(coll, report.id),
        {
          title: newName,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      if (selectedReportId === report.id && reportDraft) {
        const next = { ...reportDraft, title: newName };
        setReportDraft(next);
        setReportSnapshot(serializeReportDraft(next));
      }

      await loadSavedReports();
      showToast("Raportare redenumită.", "success");
    } catch {
      setReportError("Nu am putut redenumi raportarea.");
    } finally {
      setLibraryActionKey(null);
    }
  }

  async function duplicateReport(report: ReportInstanceDoc) {
    setLibraryActionKey(`duplicate:${report.id}`);
    setReportError(null);
    try {
      const payload = await getReportPayloadById(report.id, report);
      const duplicateId = createId();
      const { db } = initFirebase();
      const coll = getReportsCollection(db);
      await setDoc(doc(coll, duplicateId), {
        ...payload,
        title: `${payload.title} (copie)`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await loadSavedReports();
      showToast("Raportare duplicată.", "success");
    } catch {
      setReportError("Nu am putut duplica raportarea.");
    } finally {
      setLibraryActionKey(null);
    }
  }

  async function deleteReport(reportId: string) {
    if (!window.confirm("Ștergi această raportare din bibliotecă?")) return;

    setLibraryActionKey(`delete:${reportId}`);
    setReportError(null);
    try {
      const { db } = initFirebase();
      const coll = getReportsCollection(db);
      await deleteDoc(doc(coll, reportId));

      if (selectedReportId === reportId) {
        if (activeType) {
          const next = buildDraftFromType(activeType, "previous_month");
          applyDraft(next, NEW_REPORT_VALUE, true);
        } else {
          setReportDraft(null);
          setSelectedReportId(NEW_REPORT_VALUE);
          setReportSnapshot("");
        }
      }

      await loadSavedReports();
      showToast("Raportare ștearsă.", "success");
    } catch {
      setReportError("Nu am putut șterge raportarea.");
    } finally {
      setLibraryActionKey(null);
    }
  }

  async function saveCurrentReport() {
    if (!reportDraft) return;
    setSavingReport(true);
    setReportError(null);
    try {
      const normalized = normalizeReportDraft(reportDraft);
      const payload = reportInstanceSchema.parse(normalized);
      const targetId = selectedReportId === NEW_REPORT_VALUE ? createId() : selectedReportId;

      const { db } = initFirebase();
      const coll = getReportsCollection(db);
      await setDoc(
        doc(coll, targetId),
        {
          ...payload,
          updatedAt: serverTimestamp(),
          ...(selectedReportId === NEW_REPORT_VALUE ? { createdAt: serverTimestamp() } : {}),
        },
        { merge: true }
      );

      applyDraft(payload, targetId, false);
      await loadSavedReports();
      showToast("Raportarea a fost salvată.", "success");
    } catch (error: any) {
      if (error?.issues?.[0]?.message) {
        setReportError(String(error.issues[0].message));
      } else {
        setReportError("Nu am putut salva raportarea.");
      }
    } finally {
      setSavingReport(false);
    }
  }

  async function exportReport(kind: "pdf" | "excel", report: ReportDraft) {
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

    if (!response.ok) {
      throw new Error("Exportul nu a putut fi generat.");
    }

    const blob = await response.blob();
    const extension = kind === "pdf" ? "pdf" : "xlsx";
    const filename = `${safeFilename(normalizedReport.title)}.${extension}`;
    downloadBlob(blob, filename);
  }

  async function exportCurrentPdf() {
    if (!reportDraft) return;
    setExportingPdf(true);
    setReportError(null);
    try {
      await exportReport("pdf", reportDraft);
      showToast("Export PDF finalizat.", "success");
    } catch (error: any) {
      setReportError(error?.message || "Nu am putut exporta PDF.");
    } finally {
      setExportingPdf(false);
    }
  }

  async function exportCurrentExcel() {
    if (!reportDraft) return;
    setExportingExcel(true);
    setReportError(null);
    try {
      await exportReport("excel", reportDraft);
      showToast("Export Excel finalizat.", "success");
    } catch (error: any) {
      setReportError(error?.message || "Nu am putut exporta Excel.");
    } finally {
      setExportingExcel(false);
    }
  }

  async function exportSavedReport(kind: "pdf" | "excel", report: ReportInstanceDoc) {
    setLibraryActionKey(`${kind}:${report.id}`);
    setReportError(null);
    try {
      const payload = await getReportPayloadById(report.id, report);
      await exportReport(kind, payload);
      showToast(kind === "pdf" ? "Export PDF finalizat." : "Export Excel finalizat.", "success");
    } catch {
      setReportError("Nu am putut exporta raportarea selectată.");
    } finally {
      setLibraryActionKey(null);
    }
  }

  const shellTitle = reportDraft?.title || "Report Builder";
  const shellSubtitle = reportDraft
    ? `${formatDateRo(reportDraft.periodStart)} - ${formatDateRo(reportDraft.periodEnd)} · ${reportDraft.rows.length} rânduri`
    : "Configurează raportul și exportă.";

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed right-4 top-4 z-[90]">
          <div
            className={`rounded-xl border px-4 py-3 text-sm shadow-lg ${
              toast.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : toast.type === "error"
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-blue-200 bg-blue-50 text-blue-800"
            }`}
          >
            <div className="flex items-center gap-2">
              <span>{toast.message}</span>
              <button
                type="button"
                className="rounded-md px-2 py-1 text-xs hover:bg-white/60"
                onClick={() => setToast(null)}
              >
                Închide
              </button>
            </div>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "reports" | "types")}> 
        <TabsList>
          <TabsTrigger value="reports">Rapoarte</TabsTrigger>
          <TabsTrigger value="types">Tipuri</TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="space-y-4">
          {activeTypes.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Nu există tipuri de raportare</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-gray-600">
                <div>Creează mai întâi un tip de raport în tab-ul „Tipuri”.</div>
                <Button onClick={() => setActiveTab("types")}>Mergi la Tipuri</Button>
              </CardContent>
            </Card>
          ) : (
            <ReportShell
              types={activeTypes}
              activeTypeId={activeReportTypeId}
              onSelectType={handleSelectTypeForReport}
              onCreateReport={handleCreateReportClick}
              onOpenLibrary={() => setLibraryOpen(true)}
              onSaveReport={() => {
                void saveCurrentReport();
              }}
              onExportPdf={() => {
                void exportCurrentPdf();
              }}
              onExportExcel={() => {
                void exportCurrentExcel();
              }}
              title={shellTitle}
              subtitle={shellSubtitle}
              status={reportStatus}
              dirty={reportDirty}
              saveLoading={savingReport}
              saveDisabled={!reportDraft || savingReport || loadingReports || loadingSelectedReport}
              exportPdfLoading={exportingPdf}
              exportPdfDisabled={!reportDraft || exportingPdf || savingReport}
              exportExcelLoading={exportingExcel}
              exportExcelDisabled={!reportDraft || exportingExcel || savingReport}
            >
              {reportDraft ? (
                <Card>
                  <CardContent className="p-4">
                    <Tabs defaultValue="detalii">
                      <TabsList>
                        <TabsTrigger value="detalii">Detalii</TabsTrigger>
                        <TabsTrigger value="continut">Conținut</TabsTrigger>
                        <TabsTrigger value="export">Export</TabsTrigger>
                      </TabsList>

                      <TabsContent value="detalii" className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                          <div className="space-y-2 lg:col-span-2">
                            <label className="text-sm font-medium text-gray-700">Titlu raport</label>
                            <Input
                              value={reportDraft.title}
                              onChange={(event) => {
                                const value = event.target.value;
                                setTitleAutoMode(false);
                                setReportDraft((previous) =>
                                  previous ? { ...previous, title: value } : previous
                                );
                              }}
                            />
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <span>{titleAutoMode ? "Titlu automat activ" : "Titlu editat manual"}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setTitleAutoMode(true);
                                  setReportDraft((previous) => {
                                    if (!previous) return previous;
                                    return {
                                      ...previous,
                                      title: buildAutoReportTitle(
                                        previous.typeNameSnapshot,
                                        previous.periodStart,
                                        previous.periodEnd
                                      ),
                                    };
                                  });
                                }}
                              >
                                <RefreshCcw className="h-3 w-3" />
                                Regenerare titlu
                              </Button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Număr de înregistrare</label>
                            <Input
                              value={reportDraft.registrationNumber}
                              onChange={(event) =>
                                setReportDraft((previous) =>
                                  previous
                                    ? {
                                        ...previous,
                                        registrationNumber: event.target.value,
                                      }
                                    : previous
                                )
                              }
                              placeholder="Ex: 1234/2026"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Tip raportare</label>
                            <Input value={reportDraft.typeNameSnapshot} disabled />
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Preset perioadă</label>
                            <Select
                              value={reportDraft.periodPreset}
                              onValueChange={(value) => handlePeriodPresetChange(value as PeriodPreset)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selectează preset" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="previous_month">Luna anterioară</SelectItem>
                                <SelectItem value="previous_year">Anul anterior</SelectItem>
                                <SelectItem value="custom">Custom</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Perioada start</label>
                            <Input
                              type="date"
                              value={reportDraft.periodStart}
                              onChange={(event) => handleCustomPeriodChange("start", event.target.value)}
                              disabled={reportDraft.periodPreset !== "custom"}
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Perioada final</label>
                            <Input
                              type="date"
                              value={reportDraft.periodEnd}
                              onChange={(event) => handleCustomPeriodChange("end", event.target.value)}
                              disabled={reportDraft.periodPreset !== "custom"}
                            />
                          </div>
                        </div>

                        {settingsStatus && (!settingsStatus.hasIntocmit || !settingsStatus.hasAprobat) && (
                          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                            Semnăturile din Settings sunt incomplete. Exportul poate omite datele APROBAT/ÎNTOCMIT.
                          </div>
                        )}
                      </TabsContent>

                      <TabsContent value="continut" className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-gray-600">
                            Adaugă rânduri pe coloanele definite în tipul raportării.
                          </div>
                          <Button onClick={openAddRowSheet}>
                            <Plus className="h-4 w-4" />
                            Adaugă rând
                          </Button>
                        </div>

                        <div className="overflow-x-auto rounded-lg border border-gray-200">
                          <table className="min-w-full text-sm">
                            <thead className="bg-slate-200 text-gray-800">
                              <tr>
                                <th className="px-3 py-2 text-left font-semibold">Nr. crt.</th>
                                {reportColumns.map((column) => (
                                  <th key={column.id} className="px-3 py-2 text-left font-semibold">
                                    {column.label}
                                    {column.required ? <span className="ml-1 text-red-600">*</span> : null}
                                  </th>
                                ))}
                                <th className="px-3 py-2 text-right font-semibold">Acțiuni</th>
                              </tr>
                            </thead>
                            <tbody>
                              {reportDraft.rows.length === 0 ? (
                                <tr>
                                  <td
                                    className="px-3 py-4 text-center text-gray-500"
                                    colSpan={reportColumns.length + 2}
                                  >
                                    Nu există rânduri încă.
                                  </td>
                                </tr>
                              ) : (
                                reportDraft.rows.map((row, index) => (
                                  <tr
                                    key={row.id}
                                    className="cursor-pointer border-t border-gray-200 hover:bg-gray-50"
                                    onClick={() => openEditRowSheet(index)}
                                  >
                                    <td className="px-3 py-3 text-gray-500">{index + 1}</td>
                                    {reportColumns.map((column) => (
                                      <td key={`${row.id}:${column.id}`} className="max-w-[300px] truncate px-3 py-3 text-gray-900">
                                        {row.cells[column.id] || "—"}
                                      </td>
                                    ))}
                                    <td className="px-3 py-3 text-right">
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          removeRow(index);
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </TabsContent>

                      <TabsContent value="export" className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                          <Card>
                            <CardHeader>
                              <CardTitle>Rezumat raport</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                              <div>
                                <span className="font-medium">Titlu:</span> {reportDraft.title}
                              </div>
                              <div>
                                <span className="font-medium">Tip:</span> {reportDraft.typeNameSnapshot}
                              </div>
                              <div>
                                <span className="font-medium">Număr înregistrare:</span>{" "}
                                {reportDraft.registrationNumber || "—"}
                              </div>
                              <div>
                                <span className="font-medium">Perioadă:</span>{" "}
                                {formatDateRo(reportDraft.periodStart)} - {formatDateRo(reportDraft.periodEnd)}
                              </div>
                              <div>
                                <span className="font-medium">Coloane:</span> {reportDraft.columnsSnapshot.length}
                              </div>
                              <div>
                                <span className="font-medium">Rânduri:</span> {reportDraft.rows.length}
                              </div>
                              <div>
                                <span className="font-medium">Status:</span>{" "}
                                <Badge variant="secondary" className="ml-1">
                                  {reportStatus === "saved"
                                    ? "Salvat"
                                    : reportStatus === "modified"
                                      ? "Modificat"
                                      : "Draft"}
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>

                          <Card>
                            <CardHeader>
                              <CardTitle>Opțiuni export</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <label className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={includeSignatures}
                                  onCheckedChange={(checked) => setIncludeSignatures(checked === true)}
                                />
                                Include semnături APROBAT/ÎNTOCMIT
                              </label>
                              <Separator />
                              <Button
                                variant="outline"
                                className="w-full"
                                disabled={exportingPdf}
                                onClick={() => {
                                  void exportCurrentPdf();
                                }}
                              >
                                <Download className="h-4 w-4" />
                                {exportingPdf ? "Se exportă PDF..." : "Export PDF"}
                              </Button>
                              <Button
                                variant="outline"
                                className="w-full"
                                disabled={exportingExcel}
                                onClick={() => {
                                  void exportCurrentExcel();
                                }}
                              >
                                <Download className="h-4 w-4" />
                                {exportingExcel ? "Se exportă Excel..." : "Export Excel"}
                              </Button>
                              <Button
                                className="w-full"
                                disabled={savingReport}
                                onClick={() => {
                                  void saveCurrentReport();
                                }}
                              >
                                {savingReport ? "Se salvează..." : "Salvează în bibliotecă"}
                              </Button>
                            </CardContent>
                          </Card>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-4 text-sm text-gray-600">
                    Selectează un tip și creează un raport nou.
                  </CardContent>
                </Card>
              )}
            </ReportShell>
          )}

          {reportError && <div className="text-sm text-red-600">{reportError}</div>}
        </TabsContent>

        <TabsContent value="types" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
            <Card className="h-fit">
              <CardHeader className="pb-3">
                <CardTitle>Tipuri active</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Command>
                  <CommandInput
                    value={typeSearch}
                    onChange={(event) => setTypeSearch(event.target.value)}
                    placeholder="Caută tip..."
                  />
                  <CommandList>
                    {filteredTypes.length === 0 ? (
                      <CommandEmpty>Nu există tipuri.</CommandEmpty>
                    ) : (
                      filteredTypes.map((item) => (
                        <CommandItem
                          key={item.id}
                          active={item.id === selectedTypeId}
                          onClick={() => handleSelectTypeForEdit(item.id)}
                        >
                          <span className="block min-w-0">
                            <span className="block truncate font-medium">{item.name}</span>
                            <span className="block truncate text-xs text-gray-500">{item.description}</span>
                          </span>
                        </CommandItem>
                      ))
                    )}
                  </CommandList>
                </Command>

                <Button variant="outline" className="w-full" onClick={createNewType}>
                  <Plus className="h-4 w-4" />
                  Tip nou
                </Button>

                <Button variant="ghost" className="w-full" onClick={() => void loadTypes()}>
                  <RefreshCcw className="h-4 w-4" />
                  Reîncarcă tipuri
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{selectedTypeId !== NEW_TYPE_VALUE ? "Editează tip" : "Tip nou"}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Nume</label>
                    <Input
                      value={typeDraft.name}
                      onChange={(event) =>
                        setTypeDraft((previous) => ({
                          ...previous,
                          name: event.target.value,
                        }))
                      }
                      placeholder="Ex: Intenții de mediatizare"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Descriere</label>
                    <Input
                      value={typeDraft.description}
                      onChange={(event) =>
                        setTypeDraft((previous) => ({
                          ...previous,
                          description: event.target.value,
                        }))
                      }
                      placeholder="Descriere scurtă"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">Coloane</div>
                      <div className="text-xs text-gray-500">
                        {typeDraft.columns.length}/{MAX_COLUMNS} coloane
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={addTypeColumn}
                      disabled={typeDraft.columns.length >= MAX_COLUMNS}
                    >
                      <Plus className="h-4 w-4" />
                      Adaugă coloană
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {typeDraft.columns.map((column, index) => (
                      <div key={column.id} className="rounded-lg border border-gray-200 p-3">
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.6fr)_160px_120px_120px_auto]">
                          <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-600">Titlu coloană</label>
                            <Input
                              value={column.label}
                              onChange={(event) =>
                                updateTypeColumn(index, {
                                  label: event.target.value,
                                })
                              }
                              placeholder={`Coloană ${index + 1}`}
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-600">Tip câmp</label>
                            <Select
                              value={column.kind}
                              onValueChange={(value) =>
                                updateTypeColumn(index, {
                                  kind: value as ReportTypeColumn["kind"],
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Tip" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="text">Text</SelectItem>
                                <SelectItem value="textarea">Textarea</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-600">Lățime</label>
                            <Select
                              value={column.width}
                              onValueChange={(value) =>
                                updateTypeColumn(index, {
                                  width: value as ReportTypeColumn["width"],
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Lățime" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="s">S</SelectItem>
                                <SelectItem value="m">M</SelectItem>
                                <SelectItem value="l">L</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-medium text-gray-600">Obligatoriu</label>
                            <label className="flex h-10 items-center gap-2 rounded-md border border-gray-200 px-3">
                              <Checkbox
                                checked={column.required}
                                onCheckedChange={(checked) =>
                                  updateTypeColumn(index, {
                                    required: checked === true,
                                  })
                                }
                              />
                              <span className="text-sm">Da</span>
                            </label>
                          </div>

                          <div className="flex items-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => moveTypeColumn(index, "up")}
                              disabled={index === 0}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => moveTypeColumn(index, "down")}
                              disabled={index === typeDraft.columns.length - 1}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => removeTypeColumn(index)}
                              disabled={typeDraft.columns.length <= 1}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {typeError && <div className="text-sm text-red-600">{typeError}</div>}

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-gray-500">
                    {typeDirty ? "Modificări nesalvate" : "Fără modificări"}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button onClick={() => void saveTypeDraft()} disabled={typeSaving}>
                      {typeSaving ? "Se salvează..." : "Salvează"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void duplicateType()}
                      disabled={!selectedType || typeActionKey !== null}
                    >
                      <Copy className="h-4 w-4" />
                      Duplică
                    </Button>
                    <Button
                      variant="outline"
                      className="text-amber-700"
                      onClick={() => void archiveType()}
                      disabled={!selectedType || typeActionKey !== null}
                    >
                      <Archive className="h-4 w-4" />
                      Arhivează
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {loadingTypes && <div className="text-xs text-gray-500">Se încarcă tipurile...</div>}
        </TabsContent>
      </Tabs>

      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Raport nou</DialogTitle>
            <DialogDescription>
              Selectează tipul raportării și perioada pentru instanța nouă.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Tip raportare</label>
              <Select value={newTypeId} onValueChange={setNewTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selectează tip" />
                </SelectTrigger>
                <SelectContent>
                  {activeTypes.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Preset perioadă</label>
              <Select
                value={newPeriodPreset}
                onValueChange={(value) => setNewPeriodPreset(value as PeriodPreset)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selectează preset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="previous_month">Luna anterioară</SelectItem>
                  <SelectItem value="previous_year">Anul anterior</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newPeriodPreset === "custom" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Perioada start</label>
                  <Input
                    type="date"
                    value={newCustomStart}
                    onChange={(event) => setNewCustomStart(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Perioada final</label>
                  <Input
                    type="date"
                    value={newCustomEnd}
                    onChange={(event) => setNewCustomEnd(event.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="ghost" onClick={() => setNewDialogOpen(false)}>
                Închide
              </Button>
              <Button onClick={handleApplyNewReport} disabled={!newTypeId}>
                Creează raport
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Bibliotecă rapoarte</DialogTitle>
            <DialogDescription>
              Caută raportări salvate și folosește acțiuni rapide: load, rename, duplicate, export, delete.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Command>
              <CommandInput
                value={libraryQuery}
                onChange={(event) => setLibraryQuery(event.target.value)}
                placeholder="Caută după titlu, număr, perioadă..."
              />
              <CommandList>
                {libraryReports.length === 0 ? (
                  <CommandEmpty>Nu există raportări care să corespundă căutării.</CommandEmpty>
                ) : (
                  <ScrollArea className="h-[360px]">
                    <div className="space-y-2 p-2">
                      {libraryReports.map((report) => {
                        const rowBusy = libraryActionKey?.endsWith(`:${report.id}`);
                        const isSelected = selectedReportId === report.id;
                        return (
                          <div
                            key={report.id}
                            className={`rounded-lg border p-3 ${
                              isSelected ? "border-blue-300 bg-blue-50/50" : "border-gray-200 bg-white"
                            }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate font-semibold text-gray-900">{report.title}</div>
                                <div className="mt-1 text-xs text-gray-600">
                                  Nr: {report.registrationNumber || "—"} · Perioada:{" "}
                                  {formatDateRo(report.periodStart)} - {formatDateRo(report.periodEnd)}
                                </div>
                                <div className="mt-1 text-xs text-gray-500">
                                  Rânduri: {report.rows.length} · Actualizat: {formatFirestoreTimestamp(report.updatedAt) || "—"}
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant={isSelected ? "default" : "outline"}
                                  onClick={() => {
                                    void loadReport(report.id, report);
                                  }}
                                  disabled={Boolean(rowBusy)}
                                >
                                  {libraryActionKey === `load:${report.id}` ? "Se încarcă..." : "Încarcă"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    void exportSavedReport("pdf", report);
                                  }}
                                  disabled={Boolean(rowBusy)}
                                >
                                  {libraryActionKey === `pdf:${report.id}` ? "PDF..." : "PDF"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    void exportSavedReport("excel", report);
                                  }}
                                  disabled={Boolean(rowBusy)}
                                >
                                  {libraryActionKey === `excel:${report.id}` ? "Excel..." : "Excel"}
                                </Button>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button size="sm" variant="outline" disabled={Boolean(rowBusy)}>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>Acțiuni</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => {
                                        void renameReport(report);
                                      }}
                                    >
                                      Rename
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        void duplicateReport(report);
                                      }}
                                    >
                                      Duplicate
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        void deleteReport(report.id);
                                      }}
                                      className="text-red-600 hover:bg-red-50"
                                    >
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CommandList>
            </Command>
            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setLibraryOpen(false)}>
                Închide
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={rowSheetOpen} onOpenChange={setRowSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editingRowIndex !== null ? "Editează rând" : "Adaugă rând"}</SheetTitle>
            <SheetDescription>Completează valorile pentru coloanele tipului curent.</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {reportColumns.map((column) => (
              <div key={column.id} className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {column.label}
                  {column.required ? " *" : ""}
                </label>
                {column.kind === "textarea" ? (
                  <textarea
                    value={rowDraftCells[column.id] || ""}
                    onChange={(event) =>
                      setRowDraftCells((previous) => ({
                        ...previous,
                        [column.id]: event.target.value,
                      }))
                    }
                    className="min-h-[120px] w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    placeholder={column.label}
                  />
                ) : (
                  <Input
                    value={rowDraftCells[column.id] || ""}
                    onChange={(event) =>
                      setRowDraftCells((previous) => ({
                        ...previous,
                        [column.id]: event.target.value,
                      }))
                    }
                    placeholder={column.label}
                  />
                )}
              </div>
            ))}

            {rowError && <div className="text-sm text-red-600">{rowError}</div>}

            <Separator />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRowSheetOpen(false)}>
                Renunță
              </Button>
              <Button onClick={saveRowDraft}>{editingRowIndex !== null ? "Salvează" : "Adaugă"}</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {(loadingReports || loadingSelectedReport) && (
        <div className="text-xs text-gray-500">
          {loadingSelectedReport ? "Se încarcă raportarea selectată..." : "Se încarcă biblioteca de raportări..."}
        </div>
      )}
    </div>
  );
}
