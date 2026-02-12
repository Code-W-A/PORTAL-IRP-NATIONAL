"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, doc, getDocs } from "firebase/firestore";
import { CheckSquare, Download, Eye, Loader2, Mail, RefreshCw, Search, User } from "lucide-react";

import type { Bicp } from "@/app/(admin-irp)/lista-BICP/hooks/useBicpData";
import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

type RecipientItem = {
  email: string;
  name: string;
  redactie: string;
};

type SendResult = {
  type: "success" | "error";
  message: string;
  requestId?: string;
};

type SendPublicPdfEmailDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentItem: Bicp | null;
};

function isValidEmail(value: string) {
  const email = String(value || "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatDate(docLike: any): string {
  if (docLike?.dataTimestamp?.toDate) {
    const date = docLike.dataTimestamp.toDate();
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = String(date.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  }

  if (docLike?.data && typeof docLike.data === "string") {
    const str = docLike.data.trim();
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const [yyyy, mm, dd] = str.split("-");
      return `${dd}/${mm}/${yyyy}`;
    }
    return str;
  }

  if (docLike?.data?.toDate) {
    const date = docLike.data.toDate();
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = String(date.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  }

  return "-";
}

export function SendPublicPdfEmailDialog({ open, onOpenChange, documentItem }: SendPublicPdfEmailDialogProps) {
  const { db, auth } = initFirebase();

  const [recipients, setRecipients] = useState<RecipientItem[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);

  const tenant = getTenantContext();

  const publicPdfDownloadUrl = useMemo(() => {
    if (!documentItem) return "";
    return `/api/comunicate/${encodeURIComponent(documentItem.id)}/pdf?variant=public&judetId=${encodeURIComponent(tenant.judetId)}&structuraId=${encodeURIComponent(tenant.structuraId)}&debug=1`;
  }, [documentItem, tenant.judetId, tenant.structuraId]);

  const publicPdfPreviewUrl = useMemo(() => {
    if (!publicPdfDownloadUrl) return "";
    return `${publicPdfDownloadUrl}&disposition=inline`;
  }, [publicPdfDownloadUrl]);

  async function loadRecipients() {
    if (!open) return;

    setLoadingRecipients(true);
    setLoadingError(null);
    setResult(null);

    try {
      const { judetId, structuraId } = getTenantContext();
      const snap = await getDocs(collection(doc(db, `Judete/${judetId}/Structuri/${structuraId}`), "Jurnalisti"));

      const map = new Map<string, RecipientItem>();
      snap.docs.forEach((row) => {
        const data = row.data() as any;
        const email = String(data?.email || "").trim().toLowerCase();
        if (!isValidEmail(email)) return;

        const existing = map.get(email);
        const candidate: RecipientItem = {
          email,
          name: String(data?.nume || "").trim() || "Jurnalist",
          redactie: String(data?.redactie || "").trim(),
        };

        if (!existing) {
          map.set(email, candidate);
          return;
        }

        // Prefer row with explicit name/redactie when deduping same email.
        const existingScore = Number(Boolean(existing.name && existing.name !== "Jurnalist")) + Number(Boolean(existing.redactie));
        const candidateScore = Number(Boolean(candidate.name && candidate.name !== "Jurnalist")) + Number(Boolean(candidate.redactie));
        if (candidateScore > existingScore) {
          map.set(email, candidate);
        }
      });

      const normalized = Array.from(map.values()).sort((a, b) => {
        const byName = a.name.localeCompare(b.name, "ro");
        if (byName !== 0) return byName;
        return a.email.localeCompare(b.email, "ro");
      });

      const selectedAll: Record<string, boolean> = {};
      normalized.forEach((item) => {
        selectedAll[item.email] = true;
      });

      setRecipients(normalized);
      setSelected(selectedAll);
    } catch (error) {
      setLoadingError("Nu am putut încărca lista de jurnaliști.");
      setRecipients([]);
      setSelected({});
    } finally {
      setLoadingRecipients(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    setSearch("");
    loadRecipients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, documentItem?.id]);

  const filteredRecipients = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return recipients;
    return recipients.filter((item) => {
      const haystack = [item.name, item.email, item.redactie].join(" ").toLowerCase();
      return haystack.includes(term);
    });
  }, [recipients, search]);

  const selectedCount = useMemo(() => {
    return recipients.reduce((acc, item) => (selected[item.email] ? acc + 1 : acc), 0);
  }, [recipients, selected]);

  const selectedEmails = useMemo(() => {
    return recipients.filter((item) => selected[item.email]).map((item) => item.email);
  }, [recipients, selected]);

  function setAll(checked: boolean) {
    const next: Record<string, boolean> = {};
    recipients.forEach((item) => {
      next[item.email] = checked;
    });
    setSelected(next);
  }

  function toggleSingle(email: string, checked: boolean) {
    setSelected((prev) => ({
      ...prev,
      [email]: checked,
    }));
  }

  async function handleSend() {
    if (!documentItem || sending || selectedEmails.length === 0) return;

    setSending(true);
    setResult(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setResult({ type: "error", message: "Trebuie să fii autentificat pentru trimitere." });
        return;
      }

      const res = await fetch(`/api/comunicate/${encodeURIComponent(documentItem.id)}/send-public-pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipients: selectedEmails }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const baseError = typeof data?.error === "string" ? data.error : "Nu am putut trimite emailul.";
        const details = Array.isArray(data?.details)
          ? data.details.join(", ")
          : typeof data?.details === "string"
            ? data.details
            : "";

        setResult({
          type: "error",
          message: details ? `${baseError} (${details})` : baseError,
          requestId: typeof data?.requestId === "string" ? data.requestId : undefined,
        });
        return;
      }

      const recipientsCount = Number(data?.email?.recipientsCount || selectedEmails.length);
      setResult({
        type: "success",
        message: `Email trimis cu succes către ${recipientsCount} destinatari.`,
        requestId: typeof data?.requestId === "string" ? data.requestId : undefined,
      });
    } catch (error: any) {
      setResult({
        type: "error",
        message: typeof error?.message === "string" ? error.message : "Eroare la trimiterea emailului.",
      });
    } finally {
      setSending(false);
    }
  }

  const isSendDisabled = sending || loadingRecipients || selectedEmails.length === 0 || !documentItem;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[96vw]">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <Mail size={18} /> Trimite PDF nesemnat pe email
          </DialogTitle>
          <DialogDescription>
            Selectează destinatarii și transmite documentul PDF public (fără semnături).
          </DialogDescription>
        </DialogHeader>

        {!documentItem ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Nu există un document selectat.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="text-sm font-semibold text-gray-900">Document selectat</div>
              <div className="mt-1 text-sm text-gray-700">
                {documentItem.titlu || "Fără titlu"}
              </div>
              <div className="mt-2 text-xs text-gray-600">
                Nr: <span className="font-medium text-gray-800">{String(documentItem.numarComunicat ?? documentItem.numar ?? "-")}</span>
                {"  ·  "}
                Data: <span className="font-medium text-gray-800">{formatDate(documentItem)}</span>
                {"  ·  "}
                Tip: <span className="font-medium text-gray-800">{String(documentItem.nume || documentItem.tip || "Document")}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={publicPdfPreviewUrl} target="_blank" rel="noreferrer" title="Deschide PDF-ul în tab nou">
                    <Eye size={14} /> Vizualizează PDF
                  </a>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <a href={publicPdfDownloadUrl} target="_blank" rel="noreferrer" title="Descarcă PDF-ul public">
                    <Download size={14} /> Descarcă PDF
                  </a>
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Destinatari</div>
                  <div className="text-xs text-gray-600">
                    Selectați: <span className="font-semibold text-gray-800">{selectedCount}</span> / {recipients.length}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setAll(true)} disabled={loadingRecipients || recipients.length === 0}>
                    <CheckSquare size={14} /> Selectează toți
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => setAll(false)} disabled={loadingRecipients || recipients.length === 0}>
                    Deselectează toți
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={loadRecipients} disabled={loadingRecipients}>
                    {loadingRecipients ? <Loader2 className="animate-spin" size={14} /> : <RefreshCw size={14} />} Reîncarcă
                  </Button>
                </div>
              </div>

              <div className="mt-3 relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Caută după nume, email sau redacție"
                  className="pl-9"
                />
              </div>

              <div className="mt-3 rounded-lg border border-gray-200">
                <ScrollArea className="h-64">
                  <div className="divide-y divide-gray-100">
                    {loadingRecipients && (
                      <div className="p-4 text-sm text-gray-600 inline-flex items-center gap-2">
                        <Loader2 className="animate-spin" size={14} /> Se încarcă lista de destinatari...
                      </div>
                    )}

                    {!loadingRecipients && loadingError && (
                      <div className="p-4 text-sm text-red-700">{loadingError}</div>
                    )}

                    {!loadingRecipients && !loadingError && filteredRecipients.length === 0 && (
                      <div className="p-4 text-sm text-gray-600">
                        {recipients.length === 0
                          ? "Nu există jurnaliști cu email valid în structura curentă."
                          : "Nu există rezultate pentru filtrul curent."}
                      </div>
                    )}

                    {!loadingRecipients && !loadingError && filteredRecipients.map((item) => {
                      const isChecked = !!selected[item.email];
                      return (
                        <label
                          key={item.email}
                          className="flex items-start gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(value) => toggleSingle(item.email, value === true)}
                            className="mt-0.5"
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate inline-flex items-center gap-1.5">
                              <User size={14} className="text-gray-500" />
                              {item.name}
                            </div>
                            <div className="text-sm text-gray-700 truncate">{item.email}</div>
                            {item.redactie ? <div className="text-xs text-gray-500 truncate">{item.redactie}</div> : null}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>

            {result && (
              <div
                className={`rounded-lg border p-3 text-sm ${
                  result.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-red-200 bg-red-50 text-red-800"
                }`}
              >
                <div>{result.message}</div>
                {result.requestId ? <div className="text-xs mt-1 opacity-80">Request ID: {result.requestId}</div> : null}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
                Închide
              </Button>
              <Button type="button" onClick={handleSend} disabled={isSendDisabled}>
                {sending ? <Loader2 className="animate-spin" size={14} /> : <Mail size={14} />}
                {sending ? "Se trimite..." : `Trimite (${selectedEmails.length})`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
