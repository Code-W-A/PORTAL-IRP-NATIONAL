"use client";

import { useMemo, useState } from "react";
import { BarChart3, Download, FilePlus2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { initFirebase } from "@/lib/firebase";
import type {
  PublicInfoRequest,
  PublicInfoRequestDraft,
  PublicInfoRequestFilters,
} from "@/app/(admin-irp)/registru-informatii-publice/_core/types";
import { filterPublicInfoRequests, computePublicInfoStats } from "@/app/(admin-irp)/registru-informatii-publice/_core/stats";
import { savePublicInfoRequestOptionsFromDraft } from "@/app/(admin-irp)/registru-informatii-publice/_core/options";
import { usePublicInfoRequests } from "@/app/(admin-irp)/registru-informatii-publice/hooks/usePublicInfoRequests";
import PublicInfoFilters from "@/app/(admin-irp)/registru-informatii-publice/components/PublicInfoFilters";
import PublicInfoRequestTable from "@/app/(admin-irp)/registru-informatii-publice/components/PublicInfoRequestTable";
import PublicInfoRequestCardList from "@/app/(admin-irp)/registru-informatii-publice/components/PublicInfoRequestCard";
import PublicInfoRequestForm, {
  type PublicInfoFormMode,
} from "@/app/(admin-irp)/registru-informatii-publice/components/PublicInfoRequestForm";
import PublicInfoStatsPanel from "@/app/(admin-irp)/registru-informatii-publice/components/PublicInfoStats";
import {
  buildPublicInfoExportFilename,
  downloadPublicInfoRequestsExcel,
} from "@/app/(admin-irp)/registru-informatii-publice/lib/exportPublicInfoRequestsExcel";

const DEFAULT_FILTERS: PublicInfoRequestFilters = {
  search: "",
  year: "",
  month: "",
  requestType: "all",
  responseNature: "",
  receiveMethod: "",
  interestDomain: "",
};

export default function RegistruInformatiiPubliceClient() {
  const { db } = useMemo(() => initFirebase(), []);
  const {
    requests,
    options,
    loading,
    saving,
    error,
    reload,
    createRequest,
    updateRequest,
    deleteRequest,
  } = usePublicInfoRequests();

  const [filters, setFilters] = useState<PublicInfoRequestFilters>(DEFAULT_FILTERS);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<PublicInfoFormMode>("create-written");
  const [editingRequest, setEditingRequest] = useState<PublicInfoRequest | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const filteredRequests = useMemo(
    () => filterPublicInfoRequests(requests, filters),
    [requests, filters]
  );

  const stats = useMemo(() => computePublicInfoStats(filteredRequests), [filteredRequests]);

  const years = useMemo(
    () =>
      Array.from(
        new Set(
          requests
            .map((item) => {
              const parsed = Date.parse(item.requestDate);
              return Number.isFinite(parsed) ? String(new Date(parsed).getFullYear()) : "";
            })
            .filter(Boolean)
        )
      ).sort((a, b) => b.localeCompare(a)),
    [requests]
  );

  const months = useMemo(
    () =>
      Array.from(
        new Set(
          requests
            .map((item) => {
              const parsed = Date.parse(item.requestDate);
              if (!Number.isFinite(parsed)) return "";
              const date = new Date(parsed);
              return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
            })
            .filter(Boolean)
        )
      ).sort((a, b) => b.localeCompare(a)),
    [requests]
  );

  const responseNatures = useMemo(
    () =>
      Array.from(new Set([...(options?.responseNatures || []), ...requests.map((item) => item.responseNature).filter(Boolean)])).sort((a, b) =>
        a.localeCompare(b, "ro")
      ),
    [options, requests]
  );

  const receiveMethods = useMemo(
    () =>
      Array.from(new Set([...(options?.receiveMethods || []), ...requests.map((item) => item.receiveMethod).filter(Boolean)])).sort((a, b) =>
        a.localeCompare(b, "ro")
      ),
    [options, requests]
  );

  const interestDomains = useMemo(
    () =>
      Array.from(new Set([...(options?.interestDomains || []), ...requests.map((item) => item.interestDomain).filter(Boolean)])).sort((a, b) =>
        a.localeCompare(b, "ro")
      ),
    [options, requests]
  );

  function openCreate(mode: PublicInfoFormMode) {
    setEditingRequest(null);
    setFormMode(mode);
    setFormOpen(true);
  }

  function openEdit(item: PublicInfoRequest) {
    setEditingRequest(item);
    setFormMode("edit");
    setFormOpen(true);
  }

  async function handleSave(
    draft: PublicInfoRequestDraft,
    saveOptions: Record<string, boolean>
  ) {
    if (formMode === "edit" && editingRequest) {
      await updateRequest(editingRequest.id, draft);
    } else {
      await createRequest(draft);
    }

    await savePublicInfoRequestOptionsFromDraft(db, draft, {
      receiveMethod: saveOptions.receiveMethod,
      interestDomain: saveOptions.interestDomain,
      responseNature: saveOptions.responseNature,
      communicationMethod: saveOptions.communicationMethod,
      requestedInformation: saveOptions.requestedInformation,
      requesterName: saveOptions.requesterName,
    });

    await reload();
    setToast("Solicitarea a fost salvată.");
  }

  async function handleDelete(item: PublicInfoRequest) {
    if (!window.confirm("Ștergi această solicitare?")) return;
    await deleteRequest(item.id);
    setToast("Solicitarea a fost ștearsă.");
  }

  async function handleExport() {
    const filename = buildPublicInfoExportFilename({
      year: filters.year || undefined,
      month: filters.month || undefined,
    });
    await downloadPublicInfoRequestsExcel(filteredRequests, filename);
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registru solicitări informații publice</h1>
          <p className="text-sm text-gray-600">
            Introducere rapidă solicitări scrise și verbale, sincronizate cu aplicația mobilă.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void reload()} disabled={loading || saving}>
            <RefreshCw className="h-4 w-4" />
            Reîncarcă
          </Button>
          <Button variant="outline" onClick={() => setStatsOpen(true)}>
            <BarChart3 className="h-4 w-4" />
            Statistici
          </Button>
          <Button variant="outline" onClick={() => void handleExport()} disabled={!filteredRequests.length}>
            <Download className="h-4 w-4" />
            Export Excel
          </Button>
          <Button variant="outline" onClick={() => openCreate("create-verbal")}>
            <FilePlus2 className="h-4 w-4" />
            Solicitare verbală
          </Button>
          <Button onClick={() => openCreate("create-written")}>
            <FilePlus2 className="h-4 w-4" />
            Adaugă solicitare
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        {[
          { id: "all", label: "Toate" },
          { id: "written", label: "Solicitări scrise" },
          { id: "verbal", label: "Solicitări verbale" },
        ].map((tab) => (
          <Button
            key={tab.id}
            variant={filters.requestType === tab.id ? "default" : "outline"}
            size="sm"
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                requestType: tab.id as PublicInfoRequestFilters["requestType"],
              }))
            }
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <PublicInfoFilters
        filters={filters}
        years={years}
        months={months}
        responseNatures={responseNatures}
        receiveMethods={receiveMethods}
        interestDomains={interestDomains}
        onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
      />

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-500">
          Se încarcă registrul...
        </div>
      ) : (
        <>
          <PublicInfoRequestTable
            items={filteredRequests}
            onEdit={openEdit}
            onDelete={(item) => void handleDelete(item)}
          />
          <PublicInfoRequestCardList
            items={filteredRequests}
            onView={openEdit}
            onEdit={openEdit}
            onDelete={(item) => void handleDelete(item)}
          />
        </>
      )}

      {options ? (
        <PublicInfoRequestForm
          open={formOpen}
          mode={formMode}
          initialRequest={editingRequest}
          allRequests={requests}
          options={options}
          submitting={saving}
          onOpenChange={setFormOpen}
          onSave={handleSave}
        />
      ) : null}

      <PublicInfoStatsPanel open={statsOpen} stats={stats} onOpenChange={setStatsOpen} />

      {toast ? (
        <div className="fixed bottom-4 right-4 z-[70] rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 shadow-xl">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
