"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
  type Timestamp,
} from "firebase/firestore";
import { getDownloadURL, getStorage, ref as storageRef } from "firebase/storage";
import Link from "next/link";
import {
  Check,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Pencil,
  Search,
  ThumbsDown,
  ThumbsUp,
  User,
} from "lucide-react";

import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";
import type { CerereAcreditare, CerereStatus } from "@/lib/acreditari";
import { normalizeLegitimatieAttachments } from "@/lib/acreditari";

type CerereRow = {
  id: string;
  data: CerereAcreditare;
};

function tsToLabel(ts?: Timestamp | null) {
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  return d.toLocaleString("ro-RO");
}

function statusLabel(s: CerereStatus) {
  switch (s) {
    case "pending":
      return "În așteptare";
    case "approved":
      return "Aprobată";
    case "rejected":
      return "Respinsă";
  }
}

function statusCls(s: CerereStatus) {
  switch (s) {
    case "pending":
      return "bg-amber-50 border-amber-200 text-amber-900";
    case "approved":
      return "bg-emerald-50 border-emerald-200 text-emerald-900";
    case "rejected":
      return "bg-red-50 border-red-200 text-red-900";
  }
}

function safeFileName(name: string): string {
  return String(name || "fisier")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 80);
}

export default function CereriAcreditareAdminPage() {
  const { db, auth, app } = initFirebase();
  const storage = getStorage(app);
  const { judetId, structuraId } = getTenantContext();
  const currentKey = `${judetId}_${structuraId}`.toUpperCase();

  const [rows, setRows] = useState<CerereRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterStatus, setFilterStatus] = useState<"all" | CerereStatus>("pending");
  const [search, setSearch] = useState("");

  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  const [toast, setToast] = useState<{ type: "success" | "info" | "error"; message: string } | null>(null);
  const toastTimer = useRef<any>(null);
  function showToast(message: string, type: "success" | "info" | "error" = "success") {
    setToast({ type, message });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, "CereriAcreditare"),
        where("structuraKeys", "array-contains", currentKey),
        orderBy("submittedAt", "desc")
      );
      const snap = await getDocs(q);
      const list: CerereRow[] = snap.docs.map((d) => ({ id: d.id, data: d.data() as any }));
      setRows(list);
    } catch (e: any) {
      setError(e?.message || "Nu am putut încărca cererile.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, currentKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const s = (r.data.statusByStructura as any)?.[currentKey]?.status || "pending";
      if (filterStatus !== "all" && s !== filterStatus) return false;
      if (!q) return true;
      const n = String(r.data?.jurnalist?.numePrenume || "").toLowerCase();
      const nr = String(r.data?.jurnalist?.legitimatie?.numar || "").toLowerCase();
      const inst = String(r.data?.media?.denumire || "").toLowerCase();
      return n.includes(q) || nr.includes(q) || inst.includes(q) || r.id.toLowerCase().includes(q);
    });
  }, [rows, search, filterStatus, currentKey]);

  async function downloadStorage(path: string, nameHint?: string) {
    const key = `storage:${path}`;
    setDownloadingKey(key);
    try {
      const url = await getDownloadURL(storageRef(storage, path));
      const res = await fetch(url);
      if (!res.ok) throw new Error("download_failed");
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = nameHint ? safeFileName(nameHint) : safeFileName(path.split("/").pop() || "fisier");
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 1500);
    } catch {
      alert("Nu am putut descărca fișierul. Încearcă din nou.");
    } finally {
      setDownloadingKey(null);
    }
  }

  async function downloadCererePdf(cerereId: string, nameHint: string) {
    const key = `pdf:${cerereId}`;
    setDownloadingKey(key);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Trebuie să fii autentificat.");
      const res = await fetch(`/api/acreditari/cereri/${encodeURIComponent(cerereId)}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("pdf_failed");
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = `${safeFileName(nameHint)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 1500);
    } catch {
      alert("Nu am putut descărca PDF-ul cererii. Încearcă din nou.");
    } finally {
      setDownloadingKey(null);
    }
  }

  async function downloadAcreditarePdfFromCerere(cerereId: string, nameHint: string, variant: "signed" | "public") {
    const key = `acrpdf:${cerereId}:${variant}`;
    setDownloadingKey(key);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Trebuie să fii autentificat.");
      const url = `/api/acreditari/cereri/${encodeURIComponent(cerereId)}/acreditare-pdf${variant === "public" ? "?variant=public" : ""}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("pdf_failed");
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      const suffix = variant === "public" ? "_fara_semnaturi" : "_cu_semnaturi";
      a.download = `${safeFileName(nameHint)}${suffix}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 1500);
    } catch {
      alert("Nu am putut descărca PDF-ul acreditării. Încearcă din nou.");
    } finally {
      setDownloadingKey(null);
    }
  }

  async function callAction(cerereId: string, action: "approve" | "reject") {
    if (actingId) return;
    setActingId(cerereId);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        alert("Trebuie să fii autentificat pentru această acțiune.");
        return;
      }
      const res = await fetch(`/api/acreditari/cereri/${encodeURIComponent(cerereId)}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ judetId, structuraId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "action_failed");
      if (action === "approve" && data?.email?.sent) {
        const to = String(data?.email?.to || "").trim();
        showToast(`Email transmis cu succes către ${to || "jurnalist"}.`, "success");
      }
      await load();
    } catch (e: any) {
      alert(typeof e?.message === "string" ? e.message : "Acțiune eșuată.");
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed top-4 right-4 z-50">
          <div
            className={`rounded-xl border shadow-lg px-4 py-3 text-sm max-w-sm ${
              toast.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : toast.type === "error"
                  ? "bg-red-50 border-red-200 text-red-900"
                  : "bg-blue-50 border-blue-200 text-blue-900"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">{toast.message}</div>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="text-xs px-2 py-1 rounded-lg hover:bg-white/50 border border-transparent hover:border-current/10"
              >
                Închide
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-gray-900 inline-flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center">
              <FileText size={18} className="text-white" />
            </div>
            Cereri acreditare
          </div>
          <div className="text-sm text-gray-600 mt-1">
            Cereri pentru structura curentă ({judetId}/{structuraId})
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/acreditari/creaza"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
          >
            <User size={16} />
            Cerere nouă
          </Link>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors"
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin" size={16} /> : <ExternalLink size={16} />}
            Reîncarcă
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <div className="relative w-full sm:w-96">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Caută după nume / nr legit / instituție / ID"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "pending", "approved", "rejected"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setFilterStatus(v)}
              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                filterStatus === v ? "bg-white border-indigo-300 text-indigo-800 shadow-sm" : "bg-white/60 border-gray-200 text-gray-700 hover:bg-white"
              }`}
            >
              {v === "all" ? "Toate" : statusLabel(v)}
            </button>
          ))}
          <div className="text-sm text-gray-600 ml-2">
            {filtered.length}/{rows.length}
          </div>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">{error}</div>}

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6 text-sm text-gray-600 inline-flex items-center gap-2">
          <Loader2 className="animate-spin" size={16} /> Se încarcă cererile...
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-10 text-center">
          <div className="text-gray-900 font-semibold">Nicio cerere</div>
          <div className="text-sm text-gray-600 mt-1">Nu există cereri pentru filtrul curent.</div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const st: CerereStatus = ((r.data.statusByStructura as any)?.[currentKey]?.status as CerereStatus) || "pending";
            const decidedAt = (r.data.statusByStructura as any)?.[currentKey]?.decidedAt as Timestamp | undefined;
            const nume = String(r.data?.jurnalist?.numePrenume || "");
            const nrLegit = String(r.data?.jurnalist?.legitimatie?.numar || "");
            const institutie = String(r.data?.media?.denumire || "");
            const emailJ = String((r.data as any)?.jurnalist?.email || "").trim();
            const nrAcreditare = String((r.data as any)?.acreditare?.numar || "").trim();
            const dataAcreditare = String((r.data as any)?.acreditare?.data || "").trim();
            const createdAt = tsToLabel((r.data?.submittedAt as any) || (r.data?.createdAt as any));
            const legits = normalizeLegitimatieAttachments(r.data.attachments || null);
            const sigPath = (r.data.attachments as any)?.semnatura?.path as string | undefined;

            return (
              <div key={r.id} className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-lg font-semibold text-gray-900 truncate">{nume || "—"}</div>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-medium ${statusCls(st)}`}>
                        {statusLabel(st)}
                      </span>
                      {decidedAt?.toDate && (
                        <span className="text-xs text-gray-500">({tsToLabel(decidedAt)})</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-700 mt-1">
                      <span className="text-gray-500">Nr. legitimație:</span> {nrLegit || "—"}
                      <span className="mx-2 text-gray-300">•</span>
                      <span className="text-gray-500">Instituție:</span> {institutie || "—"}
                    </div>
                    {nrAcreditare ? (
                      <div className="text-sm text-gray-700 mt-1">
                        <span className="text-gray-500">Nr acreditare:</span>{" "}
                        <span className="font-semibold">{nrAcreditare}</span>
                        {dataAcreditare ? (
                          <>
                            <span className="mx-2 text-gray-300">•</span>
                            <span className="text-gray-500">Data:</span> {dataAcreditare}
                          </>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="text-xs text-gray-500 mt-1">
                      ID: <span className="font-mono">{r.id}</span>
                      {createdAt ? <span className="ml-2">• {createdAt}</span> : null}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/acreditari/creaza?tab=cerere&cerereId=${encodeURIComponent(r.id)}`}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors text-sm font-medium"
                      title="Editează cererea în formularul complex"
                    >
                      <Pencil size={14} />
                      Editează
                    </Link>
                    <button
                      type="button"
                      onClick={() => downloadCererePdf(r.id, `cerere_${nume || r.id}`)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors text-sm font-medium"
                      disabled={downloadingKey === `pdf:${r.id}`}
                      title="Descarcă PDF cu cererea completată (generat la cerere)"
                    >
                      {downloadingKey === `pdf:${r.id}` ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                      PDF cerere
                    </button>

                    <button
                      type="button"
                      onClick={() => downloadAcreditarePdfFromCerere(r.id, `acreditare_${nume || r.id}`, "signed")}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors text-sm font-medium"
                      disabled={!nrAcreditare || downloadingKey === `acrpdf:${r.id}:signed`}
                      title={nrAcreditare ? "Descarcă PDF acreditare (cu semnături) - disponibil și înainte de aprobare" : "Completează Nr acreditare pentru a putea genera PDF-ul"}
                    >
                      {downloadingKey === `acrpdf:${r.id}:signed` ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                      Acreditare PDF (cu semnături)
                    </button>

                    <button
                      type="button"
                      onClick={() => downloadAcreditarePdfFromCerere(r.id, `acreditare_${nume || r.id}`, "public")}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors text-sm font-medium"
                      disabled={!nrAcreditare || downloadingKey === `acrpdf:${r.id}:public`}
                      title={nrAcreditare ? "Descarcă PDF acreditare (fără semnături) - disponibil și înainte de aprobare" : "Completează Nr acreditare pentru a putea genera PDF-ul"}
                    >
                      {downloadingKey === `acrpdf:${r.id}:public` ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                      Acreditare PDF (fără semnături)
                    </button>

                    <div className="flex items-center gap-2 flex-wrap">
                      {legits.length > 0 ? (
                        legits.map((f, idx) => (
                          <button
                            key={`${r.id}:${f.path}:${idx}`}
                            type="button"
                            onClick={() => downloadStorage(f.path, f.name || `legitimatie_${idx + 1}.jpg`)}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors text-sm font-medium"
                            disabled={downloadingKey === `storage:${f.path}`}
                            title="Descarcă imagine legitimație"
                          >
                            {downloadingKey === `storage:${f.path}` ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                            Legit {idx + 1}
                          </button>
                        ))
                      ) : (
                        <span className="text-xs text-gray-500">Fără legitimație</span>
                      )}

                      {sigPath ? (
                        <button
                          type="button"
                          onClick={() => downloadStorage(sigPath, `semnatura_${nume || r.id}.png`)}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors text-sm font-medium"
                          disabled={downloadingKey === `storage:${sigPath}`}
                          title="Descarcă semnătura"
                        >
                          {downloadingKey === `storage:${sigPath}` ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                          Semnătură
                        </button>
                      ) : null}
                    </div>

                    <div className="w-px h-9 bg-gray-200 mx-1" />

                    {st === "pending" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const year = new Date().getFullYear();
                            const ok = confirm(
                              [
                                `Aprobi cererea pentru ${nume || "acest jurnalist"}?`,
                                "",
                                emailJ
                                  ? `Se va transmite email cu aprobarea pe anul ${year} a acreditării către: ${emailJ}`
                                  : `Nu există email în cerere. NU se va transmite email cu aprobarea pe anul ${year}.`,
                                "Emailul include acreditarea PDF (fără semnături).",
                              ].join("\n")
                            );
                            if (!ok) return;
                            callAction(r.id, "approve");
                          }}
                          disabled={actingId === r.id}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {actingId === r.id ? <Loader2 className="animate-spin" size={14} /> : <ThumbsUp size={14} />}
                          Aprobă
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const ok = confirm(`Respinge cererea pentru ${nume || "acest jurnalist"}?`);
                            if (!ok) return;
                            callAction(r.id, "reject");
                          }}
                          disabled={actingId === r.id}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {actingId === r.id ? <Loader2 className="animate-spin" size={14} /> : <ThumbsDown size={14} />}
                          Respinge
                        </button>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-2 text-sm text-gray-600">
                        <Check size={16} className="text-gray-400" />
                        Decizie luată
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


