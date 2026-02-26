"use client";

import { useMemo, useRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

import { initFirebase } from "@/lib/firebase";
import { importIcsBackupReplace } from "@/app/(admin-irp)/calendar-activitati/services/icsImport.service";
import JSZip from "jszip";

type ImportIcsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => Promise<void> | void;
};

async function readFileAsText(file: File) {
  const buffer = await file.arrayBuffer();
  return new TextDecoder("utf-8").decode(buffer);
}

async function extractIcsSources(file: File) {
  const name = file.name || "upload";
  if (name.toLowerCase().endsWith(".zip")) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const sources: Array<{ name: string; text: string }> = [];

    const entries = Object.values(zip.files).filter((entry) => !entry.dir && entry.name.toLowerCase().endsWith(".ics"));
    for (const entry of entries) {
      const text = await entry.async("text");
      sources.push({ name: entry.name, text });
    }

    return sources;
  }

  const text = await readFileAsText(file);
  return [{ name, text }];
}

export default function ImportIcsDialog({ open, onOpenChange, onImported }: ImportIcsDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fileLabel = useMemo(() => {
    if (!file) return "Alege fișier .ics";
    return `${file.name} (${Math.round(file.size / 1024)} KB)`;
  }, [file]);

  function resetState() {
    setFile(null);
    setBusy(false);
    setConfirmReplace(false);
    setMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleImport() {
    if (!file) {
      setMessage("Selectează un fișier .ics.");
      return;
    }
    if (!confirmReplace) {
      setMessage("Confirmă că vrei să înlocuiești toate activitățile curente.");
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const { auth, db } = initFirebase();
      const uid = auth.currentUser?.uid;
      if (!uid) {
        throw new Error("Trebuie să fii autentificat.");
      }

      const sources = await extractIcsSources(file);
      if (!sources.length) {
        throw new Error("Arhiva nu conține fișiere .ics.");
      }

      const result = await importIcsBackupReplace({
        db,
        userId: uid,
        sources,
      });

      setMessage(
        `Import finalizat. Backup: ${result.backupId}. Înlocuite: ${result.existingCount}. Importate: ${result.importedCount}. Sărite: ${result.skippedCount}. Erori: ${result.errorCount}.`
      );
      if (result.errorSamples?.length) {
        const preview = result.errorSamples
          .slice(0, 5)
          .map((item) => `- ${item.uid ? `${item.uid}: ` : ""}${item.reason}`)
          .join("\n");
        setMessage((prev) => `${prev}\n\nPrimele erori:\n${preview}`);
      }

      await onImported();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import eșuat.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          resetState();
        }
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Import din Google Calendar (.ics)</DialogTitle>
          <DialogDescription>
            Importul va face backup și va înlocui toate activitățile curente din calendar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-900">Fișier</div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".ics,.zip,text/calendar,application/zip"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full text-sm"
              disabled={busy}
            />
            <div className="text-xs text-gray-600">Selectat: {fileLabel}</div>
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              checked={confirmReplace}
              onChange={(e) => setConfirmReplace(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300"
              disabled={busy}
            />
            <span>
              Confirm că vreau să înlocuiesc toate activitățile curente (se face backup automat).
            </span>
          </label>

          {message && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
              {message}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Închide
            </Button>
            <Button
              type="button"
              onClick={() => void handleImport()}
              disabled={busy || !file}
            >
              {busy ? "Se importă..." : "Importă (backup + replace)"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
