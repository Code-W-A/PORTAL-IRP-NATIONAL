"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GoogleCalendarSyncSettings } from "@/app/(admin-irp)/calendar-activitati/types";
import {
  loadGoogleCalendarSyncSettings,
  saveGoogleCalendarSyncSettings,
  triggerGoogleCalendarSync,
} from "@/app/(admin-irp)/calendar-activitati/services/googleCalendarSyncSettings.service";

type GoogleCalendarSyncDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSynced: () => Promise<void> | void;
  onSettingsSaved?: () => void;
};

export default function GoogleCalendarSyncDialog({
  open,
  onOpenChange,
  onSynced,
  onSettingsSaved,
}: GoogleCalendarSyncDialogProps) {
  const [settings, setSettings] = useState<GoogleCalendarSyncSettings | null>(null);
  const [url, setUrl] = useState("");
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [intervalMin, setIntervalMin] = useState(30);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const loaded = await loadGoogleCalendarSyncSettings();
      setSettings(loaded);
      setUrl(loaded.googleIcalUrl);
      setSyncEnabled(loaded.syncEnabled);
      setIntervalMin(loaded.syncIntervalMinutes);
      setMessage(loaded.lastSyncMessage || null);
    })();
  }, [open]);

  async function handleSave() {
    setBusy(true);
    setMessage(null);
    try {
      const saved = await saveGoogleCalendarSyncSettings({
        googleIcalUrl: url.trim(),
        syncEnabled,
        syncIntervalMinutes: intervalMin,
      });
      setSettings(saved);
      setMessage("Setările au fost salvate.");
      onSettingsSaved?.();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Nu s-au putut salva setările.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncNow() {
    if (!url.trim()) {
      setMessage("Introdu link-ul secret iCal din Google Calendar.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await saveGoogleCalendarSyncSettings({
        googleIcalUrl: url.trim(),
        syncEnabled,
        syncIntervalMinutes: intervalMin,
      });
      onSettingsSaved?.();
      const res = await triggerGoogleCalendarSync(url.trim());
      setMessage(res.message);
      const refreshed = await loadGoogleCalendarSyncSettings();
      setSettings(refreshed);
      await onSynced();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Sync eșuat.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Sincronizare Google Calendar → Portal</DialogTitle>
          <DialogDescription>
            Google trimite evenimentele automat în portal prin link-ul secret iCal. Evenimentele manuale din
            portal nu sunt șterse; se actualizează doar cele marcate „Google Calendar”.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-blue-900">
            <strong>Unde găsești link-ul:</strong> Google Calendar → Setări calendar → Integrare calendar →
            „Adresă secretă în format iCal” (copiază URL-ul HTTPS).
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">URL iCal secret Google</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/..."
              disabled={busy}
            />
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={syncEnabled}
              onChange={(e) => setSyncEnabled(e.target.checked)}
              disabled={busy}
              className="h-4 w-4"
            />
            Sincronizare automată cât timp pagina calendar e deschisă
          </label>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Interval automat (minute, min. 15)</label>
            <Input
              type="number"
              min={15}
              value={intervalMin}
              onChange={(e) => setIntervalMin(Number(e.target.value) || 30)}
              disabled={busy || !syncEnabled}
            />
          </div>

          {settings?.lastSyncAt ? (
            <div className="text-xs text-gray-600">
              Ultima sync: {new Date(settings.lastSyncAt).toLocaleString("ro-RO")}
              {settings.lastSyncStatus ? ` (${settings.lastSyncStatus})` : ""}
            </div>
          ) : null}

          {message ? (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-gray-800">{message}</div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              Închide
            </Button>
            <Button type="button" variant="outline" onClick={() => void handleSave()} disabled={busy}>
              Salvează setări
            </Button>
            <Button type="button" onClick={() => void handleSyncNow()} disabled={busy}>
              <RefreshCw className="h-4 w-4" />
              {busy ? "Se sincronizează..." : "Sincronizează acum"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
