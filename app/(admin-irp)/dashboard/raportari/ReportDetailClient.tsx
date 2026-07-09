"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  History,
  Pencil,
  RefreshCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ConfirmDialog from "@/app/(admin-irp)/dashboard/raportari/ConfirmDialog";
import ReportPeriodSelector from "@/app/(admin-irp)/dashboard/raportari/ReportPeriodSelector";
import ReportRowsEditor from "@/app/(admin-irp)/dashboard/raportari/ReportRowsEditor";
import ReportToast, { type ToastState } from "@/app/(admin-irp)/dashboard/raportari/ReportToast";
import ReportViewPanel from "@/app/(admin-irp)/dashboard/raportari/ReportViewPanel";
import { createId } from "@/app/(admin-irp)/dashboard/raportari/_core/firestore";
import { getTypePrefs } from "@/app/(admin-irp)/dashboard/raportari/_core/raportariSettings";
import { resolvePeriodFromPreset } from "@/app/(admin-irp)/dashboard/raportari/_core/period";
import {
  buildAutocompleteMap,
  getLastReportForType,
  suggestCompletionsForRows,
  suggestRowsFromHistory,
  syncRowsToReportPeriod,
} from "@/app/(admin-irp)/dashboard/raportari/_core/recommendations";
import {
  buildDraftFromType,
  buildReportTitle,
  normalizeReportDraft,
  serializeReportDraft,
  type ReportDraft,
} from "@/app/(admin-irp)/dashboard/raportari/_core/reportDraft";
import {
  ACTIVITATI_IMPACT_FOOTNOTE,
  ACTIVITATI_IMPACT_TYPE_ID,
} from "@/app/(admin-irp)/dashboard/raportari/_core/templates/activitatiImpact";
import { DEFAULT_UNITATE_LABEL } from "@/app/(admin-irp)/dashboard/raportari/_core/templates/shared";
import {
  getDefaultRowCellsForType,
} from "@/app/(admin-irp)/dashboard/raportari/_core/recommendations";
import { useReportActions } from "@/app/(admin-irp)/dashboard/raportari/_core/useReportActions";
import { useRaportariData } from "@/app/(admin-irp)/dashboard/raportari/_core/useRaportariData";
import { formatPeriodRangeLabel } from "@/app/(admin-irp)/dashboard/raportari/_core/title";
import type { PeriodPreset, ReportRowDoc } from "@/app/(admin-irp)/dashboard/raportari/_core/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TOAST_DURATION_MS = 4200;

type Props = {
  typeId: string;
  reportId?: string;
  mode: "create" | "existing";
};

export default function ReportDetailClient({ typeId, reportId, mode }: Props) {
  const router = useRouter();
  const { types, reports, prefs, settingsStatus, loadingTypes, error, setError, refreshAll } =
    useRaportariData();
  const { loadReportDraft, saveReport, deleteReport, exportReport } = useReportActions();

  const [loadingReport, setLoadingReport] = useState(mode === "existing");
  const [editing, setEditing] = useState(mode === "create");
  const [reportTab, setReportTab] = useState("continut");
  const [draft, setDraft] = useState<ReportDraft | null>(null);
  const [snapshot, setSnapshot] = useState("");
  const [includeSignatures, setIncludeSignatures] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [confirmCancelEdit, setConfirmCancelEdit] = useState(false);
  const [confirmCancelCreate, setConfirmCancelCreate] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingPeriodSync, setPendingPeriodSync] = useState<{
    previousStart: string;
    previousEnd: string;
  } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reportType = useMemo(() => types.find((item) => item.id === typeId), [typeId, types]);
  const typeReports = useMemo(() => reports.filter((item) => item.typeId === typeId), [reports, typeId]);
  const lastReportForType = useMemo(() => getLastReportForType(typeReports, typeId), [typeId, typeReports]);
  const persoaneDefault = settingsStatus?.intocmit?.nume || "Purtător de cuvânt";

  const dirty = Boolean(draft && serializeReportDraft(draft) !== snapshot);
  const autocompleteByColumn = useMemo(
    () => buildAutocompleteMap(draft, typeReports),
    [draft, typeReports]
  );

  const showToast = useCallback((message: string, type: NonNullable<ToastState>["type"]) => {
    setToast({ message, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  const applyDraft = useCallback((next: ReportDraft) => {
    const normalized = normalizeReportDraft(next);
    setDraft(normalized);
    setSnapshot(serializeReportDraft(normalized));
    setError(null);
  }, [setError]);

  useEffect(() => {
    if (mode !== "create" || !reportType || draft) return;
    const typePrefs = getTypePrefs(prefs, typeId);
    const initial = buildDraftFromType(reportType, "next_week", {
      prefs: typePrefs,
      registrationNumber: typePrefs?.lastRegistrationNumber,
      persoaneDefault,
    });
    applyDraft(initial);
  }, [applyDraft, draft, mode, persoaneDefault, prefs, reportType, typeId]);

  useEffect(() => {
    if (mode !== "existing" || !reportId) return;
    const currentReportId = reportId;
    let cancelled = false;

    async function load() {
      setLoadingReport(true);
      setError(null);
      try {
        const fallback = typeReports.find((item) => item.id === currentReportId);
        const payload = await loadReportDraft(currentReportId, fallback);
        if (cancelled) return;
        applyDraft(payload);
        setEditing(false);
      } catch {
        if (!cancelled) setError("Nu am putut încărca raportarea.");
      } finally {
        if (!cancelled) setLoadingReport(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [applyDraft, loadReportDraft, mode, reportId, setError, typeReports]);

  function updateDraft(updater: (previous: ReportDraft) => ReportDraft) {
    setDraft((previous) => {
      if (!previous || !reportType) return previous;
      const next = updater(previous);
      next.title = buildReportTitle(reportType, next.periodStart, next.periodEnd);
      return next;
    });
  }

  const typePrefs = useMemo(() => getTypePrefs(prefs, typeId), [prefs, typeId]);
  const lastPeriodStart =
    lastReportForType?.periodStart || typePrefs?.lastPeriodStart;
  const lastPeriodEnd =
    lastReportForType?.periodEnd || typePrefs?.lastPeriodEnd;

  function getLastSavedPeriod() {
    if (lastReportForType) {
      return { start: lastReportForType.periodStart, end: lastReportForType.periodEnd };
    }
    if (typePrefs?.lastPeriodStart && typePrefs?.lastPeriodEnd) {
      return { start: typePrefs.lastPeriodStart, end: typePrefs.lastPeriodEnd };
    }
    return null;
  }

  function applyPeriodChange(
    updater: (previous: ReportDraft) => Pick<ReportDraft, "periodPreset" | "periodStart" | "periodEnd">
  ) {
    updateDraft((previous) => {
      const previousPeriod = { start: previous.periodStart, end: previous.periodEnd };
      const nextFields = updater(previous);
      const nextPeriod = { start: nextFields.periodStart, end: nextFields.periodEnd };

      if (
        previous.rows.length > 0 &&
        (previousPeriod.start !== nextPeriod.start || previousPeriod.end !== nextPeriod.end)
      ) {
        setPendingPeriodSync({
          previousStart: previousPeriod.start,
          previousEnd: previousPeriod.end,
        });
      }

      return {
        ...previous,
        ...nextFields,
      };
    });
  }

  function handlePeriodPresetChange(preset: PeriodPreset) {
    applyPeriodChange((previous) => {
      const lastSaved = getLastSavedPeriod();
      const period =
        preset === "custom"
          ? { start: previous.periodStart, end: previous.periodEnd }
          : resolvePeriodFromPreset(preset, undefined, new Date(), lastSaved);

      return {
        periodPreset: preset,
        periodStart: period.start,
        periodEnd: period.end,
      };
    });
  }

  function handleCustomPeriodChange(field: "start" | "end", value: string) {
    applyPeriodChange((previous) => ({
      periodPreset: "custom",
      periodStart: field === "start" ? value : previous.periodStart,
      periodEnd: field === "end" ? value : previous.periodEnd,
    }));
  }

  function applyPendingPeriodSyncToRows() {
    if (!draft || !pendingPeriodSync) return;
    const rows = syncRowsToReportPeriod(
      draft.rows,
      { start: pendingPeriodSync.previousStart, end: pendingPeriodSync.previousEnd },
      { start: draft.periodStart, end: draft.periodEnd }
    );
    setDraft((previous) => (previous ? { ...previous, rows } : previous));
    setPendingPeriodSync(null);
    showToast("Datele rândurilor au fost actualizate pentru noua perioadă.", "success");
  }

  function addRow() {
    if (!draft) return;
    const row: ReportRowDoc = {
      id: createId(),
      cells: getDefaultRowCellsForType(typeId, {
        unitate: DEFAULT_UNITATE_LABEL,
        dataIso: draft.periodStart,
        persoane: persoaneDefault,
      }),
    };
    setDraft((previous) => (previous ? { ...previous, rows: [...previous.rows, row] } : previous));
  }

  function duplicateRow(index: number) {
    if (!draft) return;
    const source = draft.rows[index];
    if (!source) return;
    const clone: ReportRowDoc = { id: createId(), cells: { ...source.cells } };
    setDraft((previous) => {
      if (!previous) return previous;
      const nextRows = [...previous.rows];
      nextRows.splice(index + 1, 0, clone);
      return { ...previous, rows: nextRows };
    });
  }

  function importRowsFromLastWeek() {
    if (!draft) return;
    const rows = suggestRowsFromHistory(
      lastReportForType,
      { start: draft.periodStart, end: draft.periodEnd },
      { typeId, unitate: DEFAULT_UNITATE_LABEL, persoane: persoaneDefault }
    );
    setDraft((previous) => (previous ? { ...previous, rows } : previous));
    showToast("Rândurile din ultima raportare au fost preluate.", "success");
  }

  function applySuggestedCompletions() {
    if (!draft) return;
    const rows = suggestCompletionsForRows(draft.rows, draft.columnsSnapshot, typeReports);
    setDraft((previous) => (previous ? { ...previous, rows } : previous));
    showToast("Celulele goale au fost completate din istoric.", "success");
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const result = await saveReport(draft, mode === "existing" ? reportId : undefined);
      await refreshAll();
      applyDraft(result.payload);
      showToast("Raportarea a fost salvată.", "success");

      if (mode === "create") {
        router.replace(`/dashboard/raportari/${typeId}/${result.id}`);
        return;
      }

      setEditing(false);
    } catch (err: unknown) {
      const issueMessage =
        err && typeof err === "object" && "issues" in err && Array.isArray(err.issues)
          ? String((err.issues as Array<{ message?: string }>)[0]?.message || "")
          : "";
      setError(issueMessage || "Nu am putut salva raportarea.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!reportId) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteReport(reportId);
      await refreshAll();
      showToast("Raportare ștearsă.", "success");
      router.push(`/dashboard/raportari/${typeId}`);
    } catch {
      setError("Nu am putut șterge raportarea.");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function handleExport(kind: "pdf" | "excel") {
    if (!draft) return;
    const setter = kind === "pdf" ? setExportingPdf : setExportingExcel;
    setter(true);
    setError(null);
    try {
      await exportReport(kind, draft, includeSignatures);
      showToast(kind === "pdf" ? "Export PDF finalizat." : "Export Excel finalizat.", "success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Nu am putut exporta raportarea.");
    } finally {
      setter(false);
    }
  }

  function handleCancelEdit() {
    if (dirty) {
      setConfirmCancelEdit(true);
      return;
    }
    if (draft) applyDraft(JSON.parse(snapshot) as ReportDraft);
    setEditing(false);
  }

  function handleCancelCreate() {
    if (dirty) {
      setConfirmCancelCreate(true);
      return;
    }
    router.push(`/dashboard/raportari/${typeId}`);
  }

  function confirmCancelEditAction() {
    if (draft) applyDraft(JSON.parse(snapshot) as ReportDraft);
    setEditing(false);
    setConfirmCancelEdit(false);
  }

  if (loadingTypes || loadingReport) {
    return <div className="text-sm text-gray-500">Se încarcă raportarea...</div>;
  }

  if (!reportType) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6 text-sm text-gray-600">
          <p>Tipul de raportare nu a fost găsit.</p>
          <Button asChild variant="outline">
            <Link href="/dashboard/raportari">Înapoi la tipuri</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (mode === "existing" && !draft && !loadingReport) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6 text-sm text-gray-600">
          <p>Raportarea nu a fost găsită.</p>
          <Button asChild variant="outline">
            <Link href={`/dashboard/raportari/${typeId}`}>Înapoi la listă</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!draft) {
    return <div className="text-sm text-gray-500">Se pregătește raportarea...</div>;
  }

  const listHref = `/dashboard/raportari/${typeId}`;
  const pageTitle =
    mode === "create"
      ? "Raport nou"
      : formatPeriodRangeLabel(draft.periodStart, draft.periodEnd);

  return (
    <div className="space-y-6">
      <ReportToast toast={toast} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href={listHref}>
              <ArrowLeft className="h-4 w-4" />
              {reportType.name}
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{pageTitle}</h1>
            <p className="mt-1 text-sm text-gray-600">
              {mode === "create"
                ? "Completează raportarea și salvează."
                : editing
                  ? "Mod editare activ."
                  : "Vizualizare raportare salvată."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {mode === "create" || editing ? (
            <>
              <Button variant="outline" onClick={mode === "create" ? handleCancelCreate : handleCancelEdit}>
                <X className="h-4 w-4" />
                Anulează
              </Button>
              <Button onClick={() => void handleSave()} disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? "Se salvează..." : "Salvează"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" />
                Editează
              </Button>
              <Button variant="outline" disabled={exportingPdf} onClick={() => void handleExport("pdf")}>
                <Download className="h-4 w-4" />
                {exportingPdf ? "PDF..." : "Export PDF"}
              </Button>
              <Button variant="outline" disabled={exportingExcel} onClick={() => void handleExport("excel")}>
                <Download className="h-4 w-4" />
                {exportingExcel ? "Excel..." : "Export Excel"}
              </Button>
              <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4" />
                Șterge
              </Button>
            </>
          )}
        </div>
      </div>

      {dirty && (mode === "create" || editing) ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Ai modificări nesalvate.
        </div>
      ) : null}

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      {!editing && mode === "existing" ? (
        <ReportViewPanel report={draft} />
      ) : (
        <>
          {lastReportForType && lastReportForType.id !== reportId ? (
            <Card className="border-blue-200 bg-blue-50/40">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <div className="flex items-start gap-2">
                  <History className="mt-0.5 h-4 w-4 text-blue-700" />
                  <div>
                    <div className="font-medium text-blue-900">Ultima raportare salvată</div>
                    <div className="text-blue-800">
                      {formatPeriodRangeLabel(lastReportForType.periodStart, lastReportForType.periodEnd)} ·{" "}
                      {lastReportForType.rows.length} rânduri
                    </div>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={importRowsFromLastWeek}>
                  Preia ca bază
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <ReportPeriodSelector
            periodPreset={draft.periodPreset}
            periodStart={draft.periodStart}
            periodEnd={draft.periodEnd}
            lastPeriodStart={lastPeriodStart}
            lastPeriodEnd={lastPeriodEnd}
            typeId={typeId}
            onPresetChange={handlePeriodPresetChange}
            onPeriodChange={handleCustomPeriodChange}
          />

          {pendingPeriodSync ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <span>
                Perioada s-a schimbat. Vrei să actualizezi datele din rânduri pentru noua perioadă?
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPendingPeriodSync(null)}>
                  Păstrează datele actuale
                </Button>
                <Button size="sm" onClick={applyPendingPeriodSyncToRows}>
                  Actualizează datele rândurilor
                </Button>
              </div>
            </div>
          ) : null}

          <Card>
            <CardContent className="p-4">
              <Tabs value={reportTab} onValueChange={setReportTab}>
                <TabsList>
                  <TabsTrigger value="continut">Conținut</TabsTrigger>
                  <TabsTrigger value="detalii">Detalii</TabsTrigger>
                  <TabsTrigger value="export">Export</TabsTrigger>
                </TabsList>

                <TabsContent value="continut" className="space-y-4">
                  {typeId === ACTIVITATI_IMPACT_TYPE_ID ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      {ACTIVITATI_IMPACT_FOOTNOTE}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!lastReportForType}
                      onClick={importRowsFromLastWeek}
                    >
                      <RefreshCcw className="h-4 w-4" />
                      Preia săptămâna trecută
                    </Button>
                    <Button variant="outline" size="sm" onClick={applySuggestedCompletions}>
                      <History className="h-4 w-4" />
                      Propune completări
                    </Button>
                  </div>
                  <ReportRowsEditor
                    columns={draft.columnsSnapshot}
                    rows={draft.rows}
                    reportPeriodStart={draft.periodStart}
                    reportPeriodEnd={draft.periodEnd}
                    autocompleteByColumn={autocompleteByColumn}
                    onChange={(rows) => setDraft((previous) => (previous ? { ...previous, rows } : previous))}
                    onAddRow={addRow}
                    onDuplicateRow={duplicateRow}
                  />
                </TabsContent>

                <TabsContent value="detalii" className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="space-y-2 lg:col-span-2">
                      <label className="text-sm font-medium text-gray-700">Titlu raport</label>
                      <Input
                        value={draft.title}
                        onChange={(event) =>
                          setDraft((previous) =>
                            previous ? { ...previous, title: event.target.value.toUpperCase() } : previous
                          )
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Număr de înregistrare</label>
                      <Input
                        value={draft.registrationNumber}
                        onChange={(event) =>
                          setDraft((previous) =>
                            previous ? { ...previous, registrationNumber: event.target.value } : previous
                          )
                        }
                        placeholder="Ex: 1234/2026"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Tip raportare</label>
                      <Input value={draft.typeNameSnapshot} disabled />
                    </div>
                    <div className="space-y-2 lg:col-span-2">
                      <label className="text-sm font-medium text-gray-700">Perioada raportului</label>
                      <Input
                        value={formatPeriodRangeLabel(draft.periodStart, draft.periodEnd)}
                        disabled
                      />
                    </div>
                  </div>

                  {settingsStatus && (!settingsStatus.hasIntocmit || !settingsStatus.hasAprobat) ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                      Semnăturile din Settings sunt incomplete. Exportul poate omite datele APROBAT/ÎNTOCMIT.
                    </div>
                  ) : null}
                </TabsContent>

                <TabsContent value="export" className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                    <Card>
                      <CardHeader>
                        <CardTitle>Rezumat raport</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div>
                          <span className="font-medium">Titlu:</span> {draft.title}
                        </div>
                        <div>
                          <span className="font-medium">Perioadă:</span>{" "}
                          {formatPeriodRangeLabel(draft.periodStart, draft.periodEnd)}
                        </div>
                        <div>
                          <span className="font-medium">Rânduri:</span> {draft.rows.length}
                        </div>
                        <div>
                          <span className="font-medium">Status:</span>{" "}
                          <Badge variant="secondary">{dirty ? "Modificat" : mode === "create" ? "Draft" : "Salvat"}</Badge>
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
                          Include semnături ÎNTOCMIT/APROBAT
                        </label>
                        <Separator />
                        <Button variant="outline" className="w-full" disabled={exportingPdf} onClick={() => void handleExport("pdf")}>
                          Export PDF
                        </Button>
                        <Button variant="outline" className="w-full" disabled={exportingExcel} onClick={() => void handleExport("excel")}>
                          Export Excel
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}

      <ConfirmDialog
        open={confirmCancelEdit}
        title="Renunți la modificări?"
        description="Modificările nesalvate vor fi pierdute."
        confirmLabel="Renunță"
        onConfirm={confirmCancelEditAction}
        onCancel={() => setConfirmCancelEdit(false)}
      />

      <ConfirmDialog
        open={confirmCancelCreate}
        title="Renunți la raportul nou?"
        description="Datele introduse vor fi pierdute."
        confirmLabel="Renunță"
        onConfirm={() => router.push(listHref)}
        onCancel={() => setConfirmCancelCreate(false)}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Șterge raportarea"
        description={`Sigur ștergi raportarea pentru perioada ${formatPeriodRangeLabel(draft.periodStart, draft.periodEnd)}?`}
        confirmLabel="Șterge"
        variant="destructive"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
