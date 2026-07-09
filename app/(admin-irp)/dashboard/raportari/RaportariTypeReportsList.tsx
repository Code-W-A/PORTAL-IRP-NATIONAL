"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, MoreHorizontal, Plus, Search } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";

import ConfirmDialog from "@/app/(admin-irp)/dashboard/raportari/ConfirmDialog";
import ReportEvidentaPanel from "@/app/(admin-irp)/dashboard/raportari/ReportEvidentaPanel";
import ReportToast, { type ToastState } from "@/app/(admin-irp)/dashboard/raportari/ReportToast";
import { formatFirestoreTimestamp } from "@/app/(admin-irp)/dashboard/raportari/_core/reportDraft";
import { useReportActions } from "@/app/(admin-irp)/dashboard/raportari/_core/useReportActions";
import { useRaportariData } from "@/app/(admin-irp)/dashboard/raportari/_core/useRaportariData";
import { formatPeriodRangeLabel } from "@/app/(admin-irp)/dashboard/raportari/_core/title";
import type { ReportInstanceDoc } from "@/app/(admin-irp)/dashboard/raportari/_core/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TOAST_DURATION_MS = 4200;

type Props = {
  typeId: string;
};

export default function RaportariTypeReportsList({ typeId }: Props) {
  const router = useRouter();
  const { types, reports, loadingTypes, loadingReports, error, setError, refreshAll } = useRaportariData();
  const { loadReportDraft, deleteReport, exportReport } = useReportActions();

  const [query, setQuery] = useState("");
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReportInstanceDoc | null>(null);
  const [deleting, setDeleting] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reportType = useMemo(() => types.find((item) => item.id === typeId), [typeId, types]);

  const typeReports = useMemo(
    () =>
      reports
        .filter((report) => report.typeId === typeId)
        .sort((a, b) => {
          if (a.periodStart !== b.periodStart) return b.periodStart.localeCompare(a.periodStart);
          return b.periodEnd.localeCompare(a.periodEnd);
        }),
    [reports, typeId]
  );

  const filteredReports = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return typeReports;
    return typeReports.filter((report) => {
      const label = `${report.title} ${report.registrationNumber} ${report.periodStart} ${report.periodEnd} ${formatPeriodRangeLabel(report.periodStart, report.periodEnd)}`.toLowerCase();
      return label.includes(normalized);
    });
  }, [query, typeReports]);

  const showToast = useCallback((message: string, type: NonNullable<ToastState>["type"]) => {
    setToast({ message, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  async function handleExport(kind: "pdf" | "excel", report: ReportInstanceDoc) {
    setActionKey(`${kind}:${report.id}`);
    setError(null);
    try {
      const draft = await loadReportDraft(report.id, report);
      await exportReport(kind, draft, true);
      showToast(kind === "pdf" ? "Export PDF finalizat." : "Export Excel finalizat.", "success");
    } catch {
      setError("Nu am putut exporta raportarea.");
    } finally {
      setActionKey(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteReport(deleteTarget.id);
      await refreshAll();
      showToast("Raportare ștearsă.", "success");
      setDeleteTarget(null);
    } catch {
      setError("Nu am putut șterge raportarea.");
    } finally {
      setDeleting(false);
    }
  }

  if (loadingTypes) {
    return <div className="text-sm text-gray-500">Se încarcă...</div>;
  }

  if (!reportType) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6 text-sm text-gray-600">
          <p>Tipul de raportare nu a fost găsit.</p>
          <Button asChild variant="outline">
            <Link href="/dashboard/raportari">
              <ArrowLeft className="h-4 w-4" />
              Înapoi la tipuri
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <ReportToast toast={toast} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href="/dashboard/raportari">
              <ArrowLeft className="h-4 w-4" />
              Tipuri raportări
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{reportType.name}</h1>
            <p className="mt-1 text-sm text-gray-600">{reportType.description}</p>
          </div>
        </div>
        <Button asChild>
          <Link href={`/dashboard/raportari/${typeId}/nou`}>
            <Plus className="h-4 w-4" />
            Adaugă raportare
          </Link>
        </Button>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <Tabs defaultValue="raportari">
        <TabsList>
          <TabsTrigger value="raportari">Raportări</TabsTrigger>
          <TabsTrigger value="evidenta">Evidență</TabsTrigger>
        </TabsList>

        <TabsContent value="raportari" className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Caută după perioadă, titlu, număr înregistrare..."
              className="pl-9"
            />
          </div>

          {loadingReports ? (
            <div className="text-sm text-gray-500">Se încarcă raportările...</div>
          ) : filteredReports.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-gray-500">
                {typeReports.length === 0
                  ? "Nu există raportări salvate pentru acest tip."
                  : "Niciun rezultat pentru căutarea curentă."}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredReports.map((report) => {
                const busy = actionKey?.endsWith(`:${report.id}`);
                return (
                  <Card key={report.id} className="transition hover:border-blue-200">
                    <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => router.push(`/dashboard/raportari/${typeId}/${report.id}`)}
                      >
                        <div className="font-semibold text-gray-900">
                          {formatPeriodRangeLabel(report.periodStart, report.periodEnd)}
                        </div>
                        <div className="mt-1 text-sm text-gray-600">{report.title}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                          <span>Nr: {report.registrationNumber || "—"}</span>
                          <Badge variant="secondary">{report.rows.length} rânduri</Badge>
                          <span>Actualizat: {formatFirestoreTimestamp(report.updatedAt) || "—"}</span>
                        </div>
                      </button>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/dashboard/raportari/${typeId}/${report.id}`)}
                        >
                          Deschide
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" disabled={Boolean(busy)}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Acțiuni</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => void handleExport("pdf", report)}>
                              <Download className="mr-2 h-4 w-4" />
                              Export PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => void handleExport("excel", report)}>
                              <Download className="mr-2 h-4 w-4" />
                              Export Excel
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-600" onClick={() => setDeleteTarget(report)}>
                              Șterge
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="evidenta">
          <ReportEvidentaPanel
            reports={reports}
            typeId={typeId}
            typeName={reportType.name}
            loading={loadingReports}
            onOpenReport={(reportId) => router.push(`/dashboard/raportari/${typeId}/${reportId}`)}
          />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Șterge raportarea"
        description={`Sigur ștergi raportarea pentru perioada ${deleteTarget ? formatPeriodRangeLabel(deleteTarget.periodStart, deleteTarget.periodEnd) : ""}? Acțiunea nu poate fi anulată.`}
        confirmLabel="Șterge"
        variant="destructive"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
