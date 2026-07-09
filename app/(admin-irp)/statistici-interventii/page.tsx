"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { useAuth } from "@/app/(admin-irp)/providers/AuthProvider";
import { InterventionRecordDialog } from "@/app/(admin-irp)/statistici-interventii/components/InterventionRecordDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { initFirebase } from "@/lib/firebase";
import {
  createInterventionRecord,
  createInterventionType,
  deleteInterventionRecord,
  deleteInterventionType,
  listInterventionRecords,
  listInterventionTypes,
  updateInterventionType,
  validateInterventionTypeDraft,
} from "@/services/interventionStatsService";
import type {
  InterventionRecord,
  InterventionStatsFilters,
  InterventionType,
  InterventionTypeDraft,
} from "@/types/interventionStats";
import {
  computeInterventionStats,
  filterInterventionRecords,
  formatInterventionDateLabel,
} from "@/utils/interventionStats";

const PRESETS: Array<{ id: InterventionStatsFilters["preset"]; label: string }> = [
  { id: "last7", label: "7 zile" },
  { id: "last30", label: "30 zile" },
  { id: "currentYear", label: "An curent" },
  { id: "last365", label: "365 zile" },
  { id: "all", label: "Tot" },
];

export default function StatisticiInterventiiPage() {
  const { user } = useAuth();
  const { db } = initFirebase();
  const [types, setTypes] = useState<InterventionType[]>([]);
  const [records, setRecords] = useState<InterventionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<InterventionType | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preset, setPreset] = useState<InterventionStatsFilters["preset"]>("currentYear");

  const [newTypeName, setNewTypeName] = useState("");
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editingTypeName, setEditingTypeName] = useState("");
  const [typeError, setTypeError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [loadedTypes, loadedRecords] = await Promise.all([
        listInterventionTypes(db),
        listInterventionRecords(db),
      ]);
      setTypes(loadedTypes);
      setRecords(loadedRecords);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeTypes = useMemo(() => types.filter((item) => item.enabled), [types]);
  const recentRecords = useMemo(() => records.slice(0, 8), [records]);
  const filteredRecords = useMemo(
    () => filterInterventionRecords(records, { preset }),
    [records, preset]
  );
  const stats = useMemo(() => computeInterventionStats(filteredRecords), [filteredRecords]);

  function openDialog(type: InterventionType) {
    setSelectedType(type);
    setDialogOpen(true);
  }

  async function handleCreateType() {
    if (!user?.uid) return;
    const draft: InterventionTypeDraft = {
      name: newTypeName,
      enabled: true,
      sortOrder: types.length,
    };
    const errors = validateInterventionTypeDraft(draft);
    if (errors.length) {
      setTypeError(errors[0]);
      return;
    }
    try {
      await createInterventionType(db, draft, user.uid);
      setNewTypeName("");
      setTypeError(null);
      await refresh();
    } catch (err) {
      setTypeError(
        err instanceof Error && err.message === "type_name_duplicate"
          ? "Există deja un tip cu această denumire."
          : "Nu s-a putut salva tipul."
      );
    }
  }

  async function handleSaveTypeEdit(type: InterventionType) {
    if (!user?.uid) return;
    try {
      await updateInterventionType(
        db,
        type.id,
        { name: editingTypeName, enabled: type.enabled, sortOrder: type.sortOrder },
        user.uid
      );
      setEditingTypeId(null);
      setEditingTypeName("");
      await refresh();
    } catch {
      setTypeError("Nu s-a putut actualiza tipul.");
    }
  }

  async function handleToggleType(type: InterventionType) {
    if (!user?.uid) return;
    await updateInterventionType(db, type.id, { enabled: !type.enabled }, user.uid);
    await refresh();
  }

  async function handleDeleteType(type: InterventionType) {
    if (!window.confirm(`Ștergeți tipul „${type.name}"?`)) return;
    await deleteInterventionType(db, type.id);
    await refresh();
  }

  async function handleDeleteRecord(record: InterventionRecord) {
    if (!window.confirm(`Ștergeți înregistrarea „${record.typeName}"?`)) return;
    await deleteInterventionRecord(db, record.id);
    await refresh();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Statistici intervenții</h1>
        <p className="mt-1 text-sm text-gray-600">
          Evidență intervenții pe tipuri custom, cu marcaj comunicat și asociere opțională BICP.
        </p>
      </div>

      <Tabs defaultValue="inregistrare">
        <TabsList>
          <TabsTrigger value="inregistrare">Înregistrare</TabsTrigger>
          <TabsTrigger value="tipuri">Tipuri intervenție</TabsTrigger>
          <TabsTrigger value="statistici">Statistici</TabsTrigger>
        </TabsList>

        <TabsContent value="inregistrare" className="space-y-4">
          {loading ? (
            <p className="text-sm text-gray-500">Se încarcă...</p>
          ) : activeTypes.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-sm text-gray-600">
                Niciun tip activ. Adăugați tipuri în tab-ul „Tipuri intervenție”.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeTypes.map((type) => (
                <Card key={type.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{type.name}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button className="w-full" onClick={() => openDialog(type)}>
                      <Plus className="mr-2 h-4 w-4" />
                      +1
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ultimele înregistrări</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentRecords.length === 0 ? (
                <p className="text-sm text-gray-500">Nicio înregistrare.</p>
              ) : (
                recentRecords.map((record) => (
                  <div
                    key={record.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 p-3"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{record.typeName}</p>
                      <p className="text-sm text-gray-600">
                        {formatInterventionDateLabel(record.occurredAt)} ·{" "}
                        {record.communicated ? "Comunicat" : "Necomunicat"}
                        {record.bicpComunicatLabel ? ` · ${record.bicpComunicatLabel}` : ""}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-red-600" onClick={() => void handleDeleteRecord(record)}>
                      Șterge
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tipuri" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Adaugă tip nou</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Input
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="Ex: Incendiu locuință"
                className="max-w-md"
              />
              <Button onClick={() => void handleCreateType()}>Adaugă</Button>
            </CardContent>
            {typeError ? <p className="px-6 pb-4 text-sm text-red-600">{typeError}</p> : null}
          </Card>

          <div className="space-y-3">
            {types.map((type) => (
              <Card key={type.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="min-w-0 flex-1">
                    {editingTypeId === type.id ? (
                      <Input value={editingTypeName} onChange={(e) => setEditingTypeName(e.target.value)} />
                    ) : (
                      <>
                        <p className="font-medium text-gray-900">{type.name}</p>
                        <p className="text-sm text-gray-600">
                          Adăugat: {formatInterventionDateLabel(type.createdAt)}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={type.enabled ? "default" : "secondary"}>
                      {type.enabled ? "Activ" : "Inactiv"}
                    </Badge>
                    {editingTypeId === type.id ? (
                      <>
                        <Button size="sm" onClick={() => void handleSaveTypeEdit(type)}>
                          Salvează
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingTypeId(null)}>
                          Anulează
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingTypeId(type.id);
                            setEditingTypeName(type.name);
                          }}
                        >
                          Editează
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void handleToggleType(type)}>
                          {type.enabled ? "Dezactivează" : "Activează"}
                        </Button>
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => void handleDeleteType(type)}>
                          Șterge
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="statistici" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((item) => (
              <Button
                key={item.id}
                variant={preset === item.id ? "default" : "outline"}
                size="sm"
                onClick={() => setPreset(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-600">Total intervenții</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-600">Comunicate</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-gray-900">{stats.communicated}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pe tip de intervenție</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.byType.length === 0 ? (
                <p className="text-sm text-gray-500">Nu există date pentru perioada selectată.</p>
              ) : (
                stats.byType.map((item) => (
                  <div key={item.typeId} className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
                    <div>
                      <p className="font-medium text-gray-900">{item.typeName}</p>
                      <p className="text-xs text-gray-500">Comunicate: {item.communicated}</p>
                    </div>
                    <p className="text-xl font-bold text-blue-600">{item.total}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pe lună</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.monthlyTotals.length === 0 ? (
                <p className="text-sm text-gray-500">—</p>
              ) : (
                stats.monthlyTotals.map((item) => (
                  <div key={item.month} className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
                    <div>
                      <p className="font-medium text-gray-900">{item.month}</p>
                      <p className="text-xs text-gray-500">Comunicate: {item.communicated}</p>
                    </div>
                    <p className="text-xl font-bold text-blue-600">{item.total}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedType ? (
        <InterventionRecordDialog
          open={dialogOpen}
          typeId={selectedType.id}
          typeName={selectedType.name}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setSelectedType(null);
          }}
          onSubmit={async (draft) => {
            if (!user?.uid) throw new Error("Utilizator neautentificat.");
            await createInterventionRecord(db, draft, user.uid);
            await refresh();
          }}
        />
      ) : null}
    </div>
  );
}
