"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { collection, doc, getDocs } from "firebase/firestore";
import { Copy, Check, Loader2, ArrowLeft } from "lucide-react";

import { listPublicInfoRequests } from "@/app/(admin-irp)/registru-informatii-publice/_core/firestore";
import { initFirebase } from "@/lib/firebase";
import { buildReportingExport, type ReportingExport } from "@/lib/jarvis/reportingExport";
import { getTenantContext } from "@/lib/tenant";

import "../jarvis.css";
import "../command-center.css";

function firstOfMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function asDocs(snap: Awaited<ReturnType<typeof getDocs>>) {
  return snap.docs.map((item) => ({ id: item.id, ...(item.data() as Record<string, unknown>) }));
}

export default function ExportClient() {
  const [periodStart, setPeriodStart] = useState(firstOfMonth);
  const [periodEnd, setPeriodEnd] = useState(todayIso);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<ReportingExport | null>(null);
  const [copied, setCopied] = useState(false);

  const jsonText = useMemo(() => (payload ? JSON.stringify(payload, null, 2) : ""), [payload]);

  async function generate() {
    if (!periodStart || !periodEnd || periodStart > periodEnd) {
      setError("Interval invalid.");
      return;
    }

    setLoading(true);
    setError(null);
    setCopied(false);

    try {
      const { db } = initFirebase();
      const { judetId, structuraId } = getTenantContext();
      const tenantRef = doc(db, `Judete/${judetId}/Structuri/${structuraId}`);

      const [comunicateSnap, foia] = await Promise.all([
        getDocs(collection(tenantRef, "Comunicate")),
        listPublicInfoRequests(db).catch(() => []),
      ]);

      setPayload(
        buildReportingExport({
          judetId,
          structuraId,
          periodStart,
          periodEnd,
          comunicate: asDocs(comunicateSnap),
          foia,
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nu am putut citi datele.");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }

  async function copyJson() {
    if (!jsonText) return;
    try {
      await navigator.clipboard.writeText(jsonText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Nu am putut copia JSON-ul.");
    }
  }

  const irp = payload?.indicators.activitateIrp;
  const nullCount = payload?.dataQuality.missingFields.length ?? 0;

  return (
    <div className="jarvis-root">
      <div className="jarvis-hud relative z-10 max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="jarvis-label">JARVIS · read-only</p>
            <h1 className="jarvis-display mt-1 text-2xl text-white">Reporting Export</h1>
            <p className="mt-1 text-sm text-slate-400">Citește Firestore și generează JSON pentru ChatGPT. Nu scrie nimic.</p>
          </div>
          <Link href="/jarvis?tab=raportari" className="j-iconbtn">
            <ArrowLeft size={14} />
            Înapoi
          </Link>
        </div>

        <section className="j-glass j-section space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="block">
              <span className="jarvis-label">Dată început</span>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="mt-2 w-full rounded-lg border border-sky-400/20 bg-black/40 px-3 py-2 text-sm text-sky-50 outline-none"
              />
            </label>
            <label className="block">
              <span className="jarvis-label">Dată sfârșit</span>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="mt-2 w-full rounded-lg border border-sky-400/20 bg-black/40 px-3 py-2 text-sm text-sky-50 outline-none"
              />
            </label>
            <button type="button" className="j-iconbtn primary h-10" onClick={() => void generate()} disabled={loading}>
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              Generează
            </button>
          </div>
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        </section>

        {payload ? (
          <>
            <section className="j-glass j-section">
              <p className="jarvis-label">Rezumat</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <Kpi label="Comunicate" value={`${irp?.comunicate ?? 0}`} />
                <Kpi label="Buletine" value={`${irp?.buletine ?? 0}`} />
                <Kpi label="Total com. + buletine" value={`${irp?.totalComunicateBuletine ?? 0}`} />
                <Kpi label="Conferințe" value={`${irp?.conferinte ?? 0}`} />
                <Kpi label="544 scrise" value={`${irp?.solicitari544Scrise ?? 0}`} />
                <Kpi label="544 verbale" value={`${irp?.solicitari544Verbale ?? 0}`} />
                <Kpi label="544 total" value={`${irp?.totalSolicitari544 ?? 0}`} />
              </div>
              <p className="mt-4 text-sm text-amber-100">
                {nullCount} indicatori sunt null — nu există în schema Firestore. Zerole de mai sus sunt numărate pe interval.
              </p>
            </section>

            <section className="j-glass j-section">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="jarvis-label">Preview JSON</p>
                <button type="button" className="j-iconbtn primary" onClick={() => void copyJson()}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "Copiat" : "Copy JSON"}
                </button>
              </div>
              <pre className="max-h-[32rem] overflow-auto rounded-xl border border-white/10 bg-black/50 p-4 text-xs leading-5 text-sky-100">
                {jsonText}
              </pre>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="j-glass px-3 py-3">
      <p className="jarvis-label">{label}</p>
      <p className="jarvis-display mt-1 text-3xl text-teal-100">{value}</p>
    </div>
  );
}
