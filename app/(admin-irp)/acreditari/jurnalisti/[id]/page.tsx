"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Download,
  FileText,
  IdCard,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Printer,
  Save,
  Trash2,
  UserCheck,
  UserX,
  X,
} from "lucide-react";

import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";

type Journalist = {
  id: string;
  nume: string;
  email?: string;
  telefon?: string;
  legit?: string;
  redactie?: string;
  lastAcreditareYear?: number;
};

type Acr = {
  id: string;
  numar: string;
  data: string;
  nume: string;
  legit: string;
  redactie: string;
};

function safeFileName(name: string): string {
  return String(name || "acreditare")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w.-]+/g, "_")
    .slice(0, 80);
}

function normalizePhoneForTel(v?: string): string {
  const s = String(v || "").trim();
  if (!s) return "";
  return s.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
}

export default function JurnalistDetaliiPage() {
  const { db } = initFirebase();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = String(params?.id || "").trim();

  const [loading, setLoading] = useState(true);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [jurnalist, setJurnalist] = useState<Journalist | null>(null);
  const [acreditari, setAcreditari] = useState<Acr[]>([]);

  const currentYear = new Date().getFullYear();
  const isCurrent = (jurnalist?.lastAcreditareYear || 0) === currentYear;

  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<Pick<Journalist, "nume" | "email" | "telefon" | "legit" | "redactie">>({
    nume: "",
    email: "",
    telefon: "",
    legit: "",
    redactie: "",
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const { judetId, structuraId } = getTenantContext();
      const jRef = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Jurnalisti/${id}`);
      const jSnap = await getDoc(jRef);
      if (!jSnap.exists()) {
        setJurnalist(null);
        setAcreditari([]);
        return;
      }
      const j = { id: jSnap.id, ...(jSnap.data() as any) } as Journalist;
      setJurnalist(j);
      setEditDraft({
        nume: j.nume || "",
        email: j.email || "",
        telefon: j.telefon || "",
        legit: j.legit || "",
        redactie: j.redactie || "",
      });

      const acrColl = collection(doc(db, `Judete/${judetId}/Structuri/${structuraId}`), "Acreditari");
      const lg = String(j.legit || "").trim();
      if (!lg) {
        setAcreditari([]);
        return;
      }
      const snap = await getDocs(query(acrColl, where("legit", "==", lg)));
      const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as Acr[];
      // Show newest first when possible (data format is DD/MM/YYYY, so lexical sort isn't safe; use fallback by id)
      setAcreditari(list.reverse());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, id]);

  async function downloadPdf(x: Acr, variant: "signed" | "public") {
    const key = `pdf:${x.id}:${variant}`;
    if (downloadingKey) return;
    setDownloadingKey(key);
    try {
      const url = `/api/acreditari/${encodeURIComponent(x.id)}/pdf${variant === "public" ? "?variant=public" : ""}`;
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) throw new Error("download_failed");
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      const suffix = variant === "public" ? "_fara_semnaturi" : "";
      a.download = `${safeFileName(`acreditare_${x.nume || ""}${suffix}`)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 1500);
    } catch {
      alert("Nu am putut descărca PDF-ul. Încearcă din nou.");
    } finally {
      setDownloadingKey(null);
    }
  }

  function openPrintWindow(label: string) {
    const win = window.open("", "_blank");
    if (!win) {
      alert("Pop-up blocat. Permite pop-up-urile pentru a tipări.");
      return null;
    }
    try {
      win.document.title = label;
      win.document.body.innerHTML = `<div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; padding: 16px;">Se pregătește pentru tipărire...</div>`;
    } catch {}
    return win;
  }

  function writePdfPrintHtml(win: Window, objUrl: string, label: string) {
    const safeLabel = String(label || "PDF").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    win.document.open();
    win.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${safeLabel}</title>
    <style>
      html, body { margin: 0; height: 100%; }
      iframe { width: 100%; height: 100%; border: 0; }
    </style>
  </head>
  <body>
    <iframe id="pdf" src="${objUrl}"></iframe>
    <script>
      (function() {
        var f = document.getElementById('pdf');
        var done = false;
        function doPrint() {
          if (done) return;
          done = true;
          try { f.contentWindow && f.contentWindow.focus(); } catch (e) {}
          try { f.contentWindow && f.contentWindow.print(); } catch (e) { window.print(); }
        }
        f.addEventListener('load', function() { setTimeout(doPrint, 50); });
        setTimeout(doPrint, 2000);
      })();
    </script>
  </body>
</html>`);
    win.document.close();
  }

  async function printPdf(x: Acr, variant: "signed" | "public") {
    const key = `print:${x.id}:${variant}`;
    if (downloadingKey) return;
    const label = `Acreditare ${x.nume || ""}`.trim() || "Acreditare";
    const win = openPrintWindow(label);
    if (!win) return;
    setDownloadingKey(key);
    try {
      const url = `/api/acreditari/${encodeURIComponent(x.id)}/pdf${variant === "public" ? "?variant=public" : ""}`;
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) throw new Error("print_failed");
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      writePdfPrintHtml(win, objUrl, label);
      setTimeout(() => URL.revokeObjectURL(objUrl), 60_000);
    } catch {
      try {
        win.close();
      } catch {}
      alert("Nu am putut deschide pentru tipărire. Încearcă din nou.");
    } finally {
      setDownloadingKey(null);
    }
  }

  async function saveJurnalist() {
    if (!jurnalist) return;
    if (!editDraft.nume.trim()) {
      alert("Completează numele.");
      return;
    }
    const ok = confirm("Sigur vrei să salvezi modificările pentru acest jurnalist?");
    if (!ok) return;
    setSaving(true);
    try {
      const { judetId, structuraId } = getTenantContext();
      const ref = doc(db, `Judete/${judetId}/Structuri/${structuraId}/Jurnalisti/${jurnalist.id}`);
      await setDoc(ref, { ...editDraft, updatedAt: serverTimestamp() }, { merge: true });
      setJurnalist((prev) => (prev ? { ...prev, ...editDraft } : prev));
      setEditing(false);
    } catch {
      alert("Nu am putut salva modificările. Încearcă din nou.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteJurnalist() {
    if (!jurnalist) return;
    const ok = confirm("Sigur vrei să ștergi acest jurnalist? Acțiunea este ireversibilă.");
    if (!ok) return;
    try {
      const { judetId, structuraId } = getTenantContext();
      await deleteDoc(doc(db, `Judete/${judetId}/Structuri/${structuraId}/Jurnalisti/${jurnalist.id}`));
      router.push("/acreditari/jurnalisti");
    } catch {
      alert("Nu am putut șterge jurnalistul. Încearcă din nou.");
    }
  }

  const telHref = useMemo(() => {
    const t = normalizePhoneForTel(jurnalist?.telefon);
    return t ? `tel:${t}` : "";
  }, [jurnalist?.telefon]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors text-sm font-medium"
            title="Înapoi"
          >
            <ArrowLeft size={16} />
            Înapoi
          </button>
          <div>
            <div className="text-2xl font-semibold tracking-tight text-gray-900 inline-flex items-center gap-2">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isCurrent ? "bg-gradient-to-br from-green-500 to-green-600" : "bg-gradient-to-br from-yellow-500 to-yellow-600"}`}>
                {isCurrent ? <UserCheck size={18} className="text-white" /> : <UserX size={18} className="text-white" />}
              </div>
              {loading ? "Jurnalist" : jurnalist?.nume || "Jurnalist"}
            </div>
            <div className="text-sm text-gray-600 mt-1">
              {isCurrent ? `Acreditat în anul curent (${currentYear})` : `Nu este acreditat în anul curent (${currentYear})`}
            </div>
          </div>
        </div>

        {/* Cerut: edit/delete icons when accredited this year */}
        {isCurrent && jurnalist && (
          <div className="flex items-center gap-2">
            {!editing ? (
              <>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center justify-center px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-800"
                  title="Editează jurnalist"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={deleteJurnalist}
                  className="inline-flex items-center justify-center px-3 py-2 border border-red-200 text-red-700 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium"
                  title="Șterge jurnalist"
                >
                  <Trash2 size={14} />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={saveJurnalist}
                  disabled={saving || !editDraft.nume.trim()}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                  title="Salvează"
                >
                  {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                  Salvează
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setEditDraft({
                      nume: jurnalist.nume || "",
                      email: jurnalist.email || "",
                      telefon: jurnalist.telefon || "",
                      legit: jurnalist.legit || "",
                      redactie: jurnalist.redactie || "",
                    });
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-800"
                  title="Renunță"
                >
                  <X size={14} />
                  Renunță
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
          <div className="flex items-center gap-3">
            <Loader2 className="animate-spin" size={18} />
            <div className="text-sm text-gray-700">Se încarcă...</div>
          </div>
        </div>
      ) : !jurnalist ? (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
          <div className="text-sm text-gray-700">Jurnalist inexistent.</div>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500 mb-1">Nume</div>
                {editing ? (
                  <input
                    value={editDraft.nume}
                    onChange={(e) => setEditDraft((p) => ({ ...p, nume: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none bg-white"
                  />
                ) : (
                  <div className="text-sm font-medium text-gray-900">{jurnalist.nume || "—"}</div>
                )}
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-1">Legitimație</div>
                {editing ? (
                  <input
                    value={editDraft.legit || ""}
                    onChange={(e) => setEditDraft((p) => ({ ...p, legit: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none bg-white"
                  />
                ) : (
                  <div className="text-sm text-gray-800 inline-flex items-center gap-2">
                    <IdCard size={14} className="text-gray-400" />
                    <span>{jurnalist.legit || "—"}</span>
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-1">Email</div>
                {editing ? (
                  <input
                    value={editDraft.email || ""}
                    onChange={(e) => setEditDraft((p) => ({ ...p, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none bg-white"
                  />
                ) : (
                  <div className="text-sm text-gray-800 inline-flex items-center gap-2">
                    <Mail size={14} className="text-gray-400" />
                    <span>{jurnalist.email || "—"}</span>
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs text-gray-500 mb-1">Telefon</div>
                {editing ? (
                  <input
                    value={editDraft.telefon || ""}
                    onChange={(e) => setEditDraft((p) => ({ ...p, telefon: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none bg-white"
                  />
                ) : jurnalist.telefon ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-gray-800 inline-flex items-center gap-2 min-w-0">
                      <Phone size={14} className="text-gray-400" />
                      <span className="truncate">{jurnalist.telefon}</span>
                    </div>
                    {telHref && (
                      <a
                        href={telHref}
                        className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors text-xs font-medium"
                        title="Apelează"
                      >
                        <Phone size={12} />
                        Apelează
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-gray-800">—</div>
                )}
              </div>

              <div className="md:col-span-2">
                <div className="text-xs text-gray-500 mb-1">Redacție</div>
                {editing ? (
                  <input
                    value={editDraft.redactie || ""}
                    onChange={(e) => setEditDraft((p) => ({ ...p, redactie: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 focus:border-blue-600 outline-none bg-white"
                  />
                ) : (
                  <div className="text-sm text-gray-800 inline-flex items-center gap-2">
                    <Building2 size={14} className="text-gray-400" />
                    <span>{jurnalist.redactie || "—"}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between gap-3 flex-wrap">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-gray-900">
                <FileText size={16} className="text-gray-600" />
                Acreditări generate ({acreditari.length})
              </div>
            </div>

            {acreditari.length === 0 ? (
              <div className="p-6 text-sm text-gray-700">Nu există acreditări pentru acest jurnalist.</div>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr className="text-left text-gray-700">
                      <th className="px-4 py-3 font-semibold">Nr.</th>
                      <th className="px-4 py-3 font-semibold">Data</th>
                      <th className="px-4 py-3 font-semibold">Redacție</th>
                      <th className="px-4 py-3 font-semibold text-right">Acțiuni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {acreditari.map((x) => (
                      <tr key={x.id} className="hover:bg-gray-50/60">
                        <td className="px-4 py-3 font-medium text-gray-900">{x.numar || "—"}</td>
                        <td className="px-4 py-3 text-gray-700">
                          <span className="inline-flex items-center gap-1">
                            <Calendar size={12} className="text-gray-400" />
                            {x.data || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{x.redactie || "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            <Link
                              href={`/acreditari/creaza?edit=${encodeURIComponent(x.id)}`}
                              className="inline-flex items-center justify-center px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-800"
                              title="Editează acreditarea"
                            >
                              <Pencil size={14} />
                            </Link>
                            <button
                              type="button"
                              onClick={() => downloadPdf(x, "signed")}
                              disabled={!!downloadingKey}
                              className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                              title="PDF (cu semnături)"
                            >
                              {downloadingKey === `pdf:${x.id}:signed` ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                              PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => printPdf(x, "signed")}
                              disabled={!!downloadingKey}
                              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-800 disabled:opacity-60 disabled:cursor-not-allowed"
                              title="Print (cu semnături)"
                            >
                              {downloadingKey === `print:${x.id}:signed` ? <Loader2 className="animate-spin" size={14} /> : <Printer size={14} />}
                              Print
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

