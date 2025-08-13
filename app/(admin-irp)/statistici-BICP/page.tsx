"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getCountFromServer, query, where } from "firebase/firestore";
import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";
import { BarChart3, CalendarDays } from "lucide-react";

type MonthCount = { month: number; count: number };

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

  const yearsOptions = useMemo(() => {
    const current = now.getFullYear();
    return Array.from({ length: 6 }, (_, i) => current - i); // ultimii 6 ani
  }, [now]);

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
      } catch (e) {
        setError("Eroare la încărcarea statisticilor");
      } finally {
        setLoading(false);
      }
    })();
  }, [db, year]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between gap-6 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-xl">
                <BarChart3 size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Statistici Documente BI/CP</h1>
                <p className="text-lg text-gray-600 mt-1">Analiză detaliată pe structură curentă</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center gap-3 px-4 py-3 bg-white border border-gray-300 rounded-xl shadow-sm">
                <CalendarDays size={18} className="text-gray-700" />
                <select 
                  className="outline-none bg-transparent text-gray-900 font-medium"
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
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 mb-6">
            <strong>Eroare:</strong> {error}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <KpiCard title={`Total ${year}`} value={loading ? "—" : String(yearTotal)} loading={loading} />
          <KpiCard title="Luna curentă" value={loading ? "—" : String(months.find((m) => m.month === now.getMonth())?.count ?? 0)} loading={loading} />
          <KpiCard title="Media/lună" value={loading ? "—" : (yearTotal ? (yearTotal / 12).toFixed(1) : "0")} loading={loading} />
        </div>

        {/* Monthly Chart */}
        <div className="bg-white rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-100/50 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
              <CalendarDays size={18} className="text-blue-600"/>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Distribuție Lunară</h2>
              <p className="text-sm text-gray-600">Documente create pe fiecare lună din {year}</p>
            </div>
          </div>
          {loading ? (
            <MonthsSkeleton />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {months.map((m) => (
                <div key={m.month} className="group relative bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-md transition-all">
                  <div className="text-sm font-medium text-gray-600 mb-1">{monthLabel(m.month)}</div>
                  <div className="text-2xl font-bold text-gray-900">{m.count}</div>
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-b-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, loading }: { title: string; value: string; loading: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200/60 shadow-lg shadow-gray-100/50 p-6">
      <div className="text-sm font-medium text-gray-600 mb-2">{title}</div>
      {loading ? (
        <div className="h-8 w-16 bg-gray-200 rounded animate-pulse"></div>
      ) : (
        <div className="text-3xl font-bold text-gray-900">{value}</div>
      )}
    </div>
  );
}

function MonthsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="bg-gradient-to-br from-gray-50 to-white rounded-xl border border-gray-200 p-4 animate-pulse">
          <div className="h-4 w-12 bg-gray-200 rounded mb-2"></div>
          <div className="h-8 w-10 bg-gray-200 rounded"></div>
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


