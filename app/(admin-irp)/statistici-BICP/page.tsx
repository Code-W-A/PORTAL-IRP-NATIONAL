"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getCountFromServer, getDocs, query, where } from "firebase/firestore";
import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";
import { BarChart3, CalendarDays, TrendingUp, FileText, Grid3x3, PieChart, Copy } from "lucide-react";
import { JUDETE } from "@/lib/judete";

type MonthCount = { month: number; count: number };
type TypeCounts = Record<string, number>;

// Document types from creaza-BICP
const DOCUMENT_TYPES = [
  "Buletin Informativ",
  "Comunicat de Presă",
  "Știre",
  "Declarație de presă",
  "Conferință de presă",
  "Invitație",
  "Interviu",
  "Anunț",
  "Eveniment de presă",
  "Drept la replică",
  "Informare presă"
] as const;

type TabType = "lunar" | "tipuri" | "vizualizare";

function normalizeTypeLabel(data: any): string {
  const rawDocType = (data?.tipDocument || data?.nume || data?.tip || "").toString();
  if (rawDocType) {
    // If we already have the full text from `nume` or `tipDocument`, return as is
    if (DOCUMENT_TYPES.includes(rawDocType as any)) return rawDocType;
    // Map legacy short codes to friendly labels
    const upper = rawDocType.toUpperCase();
    if (upper === "BI") return "Buletin Informativ";
    if (upper === "PC" || upper === "CI") return "Comunicat de Presă";
  }
  return "Comunicat de Presă"; // reasonable default to keep monthly sums aligned
}

function getMonthRange(year: number, monthIndex0: number) {
  const start = new Date(year, monthIndex0, 1, 0, 0, 0, 0);
  const end = new Date(year, monthIndex0 + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export default function StatisticiBicpPage() {
  const { db } = initFirebase();
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [yearTotal, setYearTotal] = useState<number>(0);
  const [months, setMonths] = useState<MonthCount[]>(Array.from({ length: 12 }, (_, i) => ({ month: i, count: 0 })));
  const [yearTypeCounts, setYearTypeCounts] = useState<TypeCounts>({});
  const [monthlyTypeCounts, setMonthlyTypeCounts] = useState<Record<number, TypeCounts>>({});
  const [activeTab, setActiveTab] = useState<TabType>("lunar");
  const [selectedMonth, setSelectedMonth] = useState<number | "all">(now.getMonth());
  const [copied, setCopied] = useState(false);

  const selectedMonthCounts = useMemo(
    () => selectedMonth === "all" ? yearTypeCounts : (monthlyTypeCounts[selectedMonth] || {}),
    [monthlyTypeCounts, yearTypeCounts, selectedMonth]
  );
  const selectedMonthTotal = useMemo(
    () => selectedMonth === "all" ? yearTotal : (months.find((m) => m.month === selectedMonth)?.count || 0),
    [months, selectedMonth, yearTotal]
  );

  const yearsOptions = useMemo(() => {
    const current = now.getFullYear();
    return Array.from({ length: 6 }, (_, i) => current - i); // ultimii 6 ani
  }, [now]);

  const { judetId, structuraId } = getTenantContext();
  const structDisplay = useMemo(() => {
    const jud = JUDETE.find((j) => j.id === judetId)?.name || judetId;
    const struct = structuraId === "ISU" ? "ISU" : structuraId;
    return `${struct} ${jud}`;
  }, [judetId, structuraId]);

  const pluralMap: Record<string, string> = {
    "Comunicat de Presă": "comunicate de presă",
    "Buletin Informativ": "buletine informative",
    "Declarație de presă": "declarații de presă",
    "Conferință de presă": "conferințe de presă",
    "Invitație": "invitații de presă",
    "Interviu": "interviuri",
    "Anunț": "anunțuri",
    "Eveniment de presă": "evenimente de presă",
    "Drept la replică": "drepturi la replică",
    "Informare presă": "informări de presă",
    "Știre": "știri",
  };
  const singularMap: Record<string, string> = {
    "Comunicat de Presă": "comunicat de presă",
    "Buletin Informativ": "buletin informativ",
    "Declarație de presă": "declarație de presă",
    "Conferință de presă": "conferință de presă",
    "Invitație": "invitație de presă",
    "Interviu": "interviu",
    "Anunț": "anunț",
    "Eveniment de presă": "eveniment de presă",
    "Drept la replică": "drept la replică",
    "Informare presă": "informare de presă",
    "Știre": "știre",
  };
  function phraseFor(key: string, count: number): string {
    const label = count === 1 ? (singularMap[key] || key.toLowerCase()) : (pluralMap[key] || key.toLowerCase());
    return `${count} ${label};`;
  }

  const copyText = useMemo(() => {
    const counts = selectedMonthCounts;
    const nonZero = DOCUMENT_TYPES.filter((t) => (counts[t] || 0) > 0);
    const lines = nonZero.map((t) => phraseFor(t, counts[t] || 0));
    const periodLabel = selectedMonth === "all" ? String(year) : monthLabelsFull[selectedMonth].toLowerCase();
    const header = `${structDisplay} - ${periodLabel}`;
    return [header, ...lines].join("\n");
  }, [selectedMonthCounts, selectedMonth, year, structDisplay]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { judetId, structuraId } = getTenantContext();
        const base = collection(doc(db, `Judete/${judetId}/Structuri/${structuraId}`), "Comunicate");

        // Total pe an
        const yearStart = new Date(year, 0, 1, 0, 0, 0, 0);
        const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
        const qYear = query(base, where("dataTimestamp", ">=", yearStart), where("dataTimestamp", "<=", yearEnd));
        const totalSnap = await getCountFromServer(qYear);
        setYearTotal(totalSnap.data().count);

        // Pe luni (în paralel)
        const monthPromises = Array.from({ length: 12 }, async (_, i) => {
          const { start, end } = getMonthRange(year, i);
          const q = query(base, where("dataTimestamp", ">=", start), where("dataTimestamp", "<=", end));
          const snap = await getCountFromServer(q);
          return { month: i, count: snap.data().count } as MonthCount;
        });
        const results = await Promise.all(monthPromises);
        setMonths(results);

        // Agregare tipuri pe întreg anul (pentru UI anual + lunar stacked)
        const docsSnap = await getDocs(qYear);
        const byTypeYear: TypeCounts = {};
        const byTypeMonthly: Record<number, TypeCounts> = {};
        for (let i = 0; i < 12; i += 1) byTypeMonthly[i] = {};

        docsSnap.docs.forEach((d) => {
          const data: any = d.data();
          const ts: any = data?.dataTimestamp;
          let dt: Date | null = null;
          try { dt = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null); } catch { dt = null; }
          const monthIdx = dt ? dt.getMonth() : 0;
          const typeLabel: string = normalizeTypeLabel(data);
          byTypeYear[typeLabel] = (byTypeYear[typeLabel] || 0) + 1;
          const monthMap = byTypeMonthly[monthIdx] || (byTypeMonthly[monthIdx] = {});
          monthMap[typeLabel] = (monthMap[typeLabel] || 0) + 1;
        });
        setYearTypeCounts(byTypeYear);
        setMonthlyTypeCounts(byTypeMonthly);
      } catch (e) {
        setError("Eroare la încărcarea statisticilor");
      } finally {
        setLoading(false);
      }
    })();
  }, [db, year]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100/30 to-slate-50">
      <div className="max-w-[1920px] mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between gap-6 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-900 rounded-xl flex items-center justify-center shadow-md">
                <BarChart3 size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Statistici Documente BI/CP</h1>
                <p className="text-base text-slate-600 mt-1">Analiză detaliată pe structură curentă</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-3 px-4 py-2.5 bg-white border border-slate-200 rounded-lg shadow-sm">
                <CalendarDays size={18} className="text-slate-600" />
                <select 
                  className="outline-none bg-transparent text-slate-900 font-medium text-sm"
                  value={year} 
                  onChange={(e) => setYear(Number(e.target.value))}
                >
                  {yearsOptions.map((y) => (
                    <option key={y} value={y}>Anul {y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 mb-6">
            <strong>Eroare:</strong> {error}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
          <KpiCard title={`Total ${year}`} value={loading ? "—" : String(yearTotal)} loading={loading} icon={<FileText size={20} />} color="slate" />
          <KpiCard title="Luna curentă" value={loading ? "—" : String(months.find((m) => m.month === now.getMonth())?.count ?? 0)} loading={loading} icon={<CalendarDays size={20} />} color="slate" />
          <KpiCard title="Media/lună" value={loading ? "—" : (yearTotal ? (yearTotal / 12).toFixed(1) : "0")} loading={loading} icon={<TrendingUp size={20} />} color="slate" />
        </div>

        {/* Tabs Navigation */}
        <div className="mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-1.5 inline-flex gap-1 shadow-sm">
            <button
              onClick={() => setActiveTab("lunar")}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "lunar"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <CalendarDays size={16} />
              Detaliere Lunară
            </button>
      
            <button
              onClick={() => setActiveTab("vizualizare")}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === "vizualizare"
                  ? "bg-slate-800 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Grid3x3 size={16} />
              Vizualizare Grafică
            </button>
          </div>
        </div>

        {/* Tab Content: Detaliere Lunară */}
        {activeTab === "lunar" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                  <CalendarDays size={18} className="text-slate-700"/>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Detaliere Lunară pe Tipuri de Document</h2>
                  <p className="text-sm text-slate-600">Selectează o lună pentru a vedea defalcarea</p>
                </div>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-xs font-medium text-slate-700">Lună:</span>
                <select 
                  className="outline-none bg-transparent text-slate-900 font-medium text-sm"
                  value={selectedMonth as any} 
                  onChange={(e) => setSelectedMonth(e.target.value === "all" ? "all" : Number(e.target.value))}
                >
                  <option value="all">Toate lunile</option>
                  {monthLabelsFull.map((month, idx) => (
                    <option key={idx} value={idx}>{month}</option>
                  ))}
                </select>
              </div>
            </div>
            {loading ? (
              <div className="h-24 bg-slate-50 rounded-xl animate-pulse"/>
            ) : (
              <>
                {/* Month summary and navigation */}
                <div className="flex items-center justify-between mb-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-50 border border-slate-200 text-sm">
                    <span className="font-semibold text-slate-900">{selectedMonth === "all" ? `Toate lunile ${year}` : monthLabelsFull[selectedMonth]}</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-700">Total</span>
                    <span className="inline-flex items-center justify-center min-w-[2rem] h-6 px-2 rounded bg-slate-200 text-slate-900 font-bold">
                      {selectedMonthTotal}
                    </span>
                  </div>
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedMonth((m) => m === "all" ? 11 : ((m + 11) % 12))}
                      className="px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm"
                      aria-label="Luna anterioară"
                    >
                      ← Anterioară
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedMonth((m) => m === "all" ? 0 : ((m + 1) % 12))}
                      className="px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm"
                      aria-label="Luna următoare"
                    >
                      Următoare →
                    </button>
                  </div>
                </div>
                {/* Stacked bar similar with Tipuri */}
                <StackedBar counts={selectedMonthCounts} total={selectedMonthTotal} />
                {/* Cards same style as Tipuri */}
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  {DOCUMENT_TYPES.map((t) => (
                    <div key={t} className="rounded-lg border border-slate-200 p-4 bg-white hover:shadow-md hover:border-slate-300 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: typeColor(t) }} />
                        </div>
                        <div className="text-2xl font-bold text-slate-900">{selectedMonthCounts[t] || 0}</div>
                      </div>
                      <div className="text-sm font-medium text-slate-900 mb-1">{t}</div>
                      <div className="text-xs text-slate-600">{percent(selectedMonthCounts[t] || 0, selectedMonthTotal)} din totalul lunii</div>
                    </div>
                  ))}
                </div>

                {/* Copy block under the cards */}
                <div className="mt-6">
                  <div className="flex items-start justify-between gap-3">
                    <textarea
                      readOnly
                      value={copyText}
                      className="w-full h-28 p-3 border border-slate-200 rounded-lg bg-slate-50 text-sm text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={async () => { 
                        try { 
                          await navigator.clipboard.writeText(copyText); 
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        } catch {} 
                      }}
                      className={`shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                        copied
                          ? "border-green-300 bg-green-50 text-green-700"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <Copy size={16} /> {copied ? "Copiat" : "Copiază"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab Content: Distribuție pe Tipuri */}
        {activeTab === "tipuri" && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">

            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                <PieChart size={18} className="text-slate-700"/>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Distribuție pe tipuri – Anul {year}</h2>
                <p className="text-sm text-slate-600">Repartiția comunicatelor pe tipuri, cu ponderi</p>
              </div>
            </div>
            {loading ? (
              <div className="h-24 bg-slate-50 rounded-xl animate-pulse"/>
            ) : (
              <>
                {/* Stacked bar by type */}
                <StackedBar counts={yearTypeCounts} total={yearTotal} />
                {/* Cards */}
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  {DOCUMENT_TYPES.map((t) => (
                    <div key={t} className="rounded-lg border border-slate-200 p-4 bg-white hover:shadow-md hover:border-slate-300 transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: typeColor(t) }} />
                        </div>
                        <div className="text-2xl font-bold text-slate-900">{yearTypeCounts[t] || 0}</div>
                      </div>
                      <div className="text-sm font-medium text-slate-900 mb-1">{t}</div>
                      <div className="text-xs text-slate-600">{percent(yearTypeCounts[t] || 0, yearTotal)} din total</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab Content: Vizualizare Grafică */}
        {activeTab === "vizualizare" && (
          <div className="space-y-6">
            {/* Monthly totals */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                  <CalendarDays size={18} className="text-slate-700"/>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Distribuție Lunară (Total)</h2>
                  <p className="text-sm text-slate-600">Documente create pe fiecare lună din {year}</p>
                </div>
              </div>
              {loading ? (
                <MonthsSkeleton />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {months.map((m) => (
                    <div key={m.month} className="group relative bg-slate-50 rounded-lg border border-slate-200 p-4 hover:border-slate-400 hover:shadow-md transition-all">
                      <div className="text-sm font-medium text-slate-600 mb-1">{monthLabel(m.month)}</div>
                      <div className="text-2xl font-bold text-slate-900">{m.count}</div>
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-slate-700 rounded-b-lg opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                  ))}
                </div>
              )}
            </div>

         
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ title, value, loading, icon, color }: { title: string; value: string; loading: boolean; icon: React.ReactNode; color: string }) {
  const colorClasses = {
    slate: "bg-slate-100 text-slate-700",
  };
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 hover:shadow-md hover:border-slate-300 transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium text-slate-600">{title}</div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color as keyof typeof colorClasses]}`}>
          {icon}
        </div>
      </div>
      {loading ? (
        <div className="h-9 w-20 bg-slate-200 rounded animate-pulse"></div>
      ) : (
        <div className="text-3xl font-bold text-slate-900">{value}</div>
      )}
    </div>
  );
}

const monthLabelsFull = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie"
];

function MonthlyTypeBreakdownCards({ monthlyTypeCounts, months, selectedMonth }: { monthlyTypeCounts: Record<number, TypeCounts>; months: MonthCount[]; selectedMonth: number | "all" }) {
  const monthsToShow = selectedMonth === "all" ? Array.from({ length: 12 }, (_, i) => i) : [selectedMonth];
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {monthsToShow.map((monthIdx) => {
        const monthCounts = monthlyTypeCounts[monthIdx] || {};
        const monthTotal = months.find((m) => m.month === monthIdx)?.count || 0;
        
        return (
          <div key={monthIdx} className="group relative bg-white rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all duration-200 overflow-hidden">
            {/* Month header */}
            <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-4 py-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">{monthLabelsFull[monthIdx]}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-300">Total:</span>
                  <span className="inline-flex items-center justify-center min-w-[2rem] h-7 px-2 bg-white/10 backdrop-blur-sm rounded-md text-white font-bold text-sm">
                    {monthTotal}
                  </span>
                </div>
              </div>
            </div>

            {/* Document types list */}
            <div className="p-4 space-y-2">
              {DOCUMENT_TYPES.map((type) => {
                const count = monthCounts[type] || 0;
                return (
                  <div 
                    key={type} 
                    className={`flex items-center justify-between p-2.5 rounded-md transition-all ${
                      count === 0 
                        ? 'bg-slate-50/50' 
                        : 'bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span 
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: typeColor(type) }} 
                      />
                      <span className={`text-xs font-medium truncate ${
                        count === 0 ? 'text-slate-400' : 'text-slate-700'
                      }`}>
                        {type}
                      </span>
                    </div>
                    <span className={`inline-flex items-center justify-center min-w-[1.75rem] h-6 px-2 rounded-md font-bold text-sm ${
                      count === 0 
                        ? 'text-slate-400 bg-slate-100' 
                        : 'text-slate-800 bg-slate-200'
                    }`}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Bottom accent */}
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </div>
        );
      })}
    </div>
  );
}

function MonthsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="bg-slate-50 rounded-lg border border-slate-200 p-4 animate-pulse">
          <div className="h-4 w-12 bg-slate-200 rounded mb-2"></div>
          <div className="h-8 w-10 bg-slate-200 rounded"></div>
        </div>
      ))}
    </div>
  );
}

function monthLabel(idx0: number) {
  const labels = [
    "Ian", "Feb", "Mar", "Apr", "Mai", "Iun",
    "Iul", "Aug", "Sep", "Oct", "Noi", "Dec",
  ];
  return labels[idx0] || String(idx0 + 1);
}

function percent(count: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((count / total) * 100)}%`;
}

function sortedTypes(map: TypeCounts) {
  return Object.keys(map).sort((a, b) => (map[b] || 0) - (map[a] || 0));
}

function uniqueTypes(yearMap: TypeCounts, monthMap: TypeCounts) {
  const set = new Set<string>([...Object.keys(yearMap), ...Object.keys(monthMap)]);
  return Array.from(set);
}

function typeColor(key: string) {
  // Professional color palette - muted and sophisticated
  const palette = [
    "#334155", // slate-700
    "#475569", // slate-600
    "#64748b", // slate-500
    "#1e40af", // blue-800
    "#1e3a8a", // blue-900
    "#374151", // gray-700
    "#4b5563", // gray-600
    "#0f172a", // slate-900
    "#1e293b", // slate-800
  ];
  // deterministic hash
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

function StackedBar({ counts, total, heightClass = "h-4" }: { counts: TypeCounts; total: number; heightClass?: string }) {
  const types = sortedTypes(counts);
  return (
    <div className={`w-full ${heightClass} rounded-md overflow-hidden bg-slate-100 border border-slate-200`}> 
      <div className="flex h-full w-full">
        {types.map((t) => {
          const c = counts[t] || 0;
          const w = total ? Math.max(2, Math.round((c / total) * 100)) : 0; // min 2% visible
          return (
            <div key={t} className="h-full" style={{ width: `${w}%`, backgroundColor: typeColor(t) }} title={`${t}: ${c}`} />
          );
        })}
      </div>
    </div>
  );
}

function Legend({ types }: { types: string[] }) {
  if (!types.length) return null;
  return (
    <div className="mt-6 flex flex-wrap gap-2">
      {types.slice(0, 10).map((t) => (
        <span key={t} className="inline-flex items-center gap-1.5 text-xs text-slate-700 bg-slate-100 rounded-md px-2.5 py-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: typeColor(t) }} />
          {t}
        </span>
      ))}
    </div>
  );
}


