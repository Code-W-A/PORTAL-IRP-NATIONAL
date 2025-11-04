"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, doc, getCountFromServer, query, where } from "firebase/firestore";
import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";
import { BarChart3, TrendingUp, Calendar, ThumbsUp, ThumbsDown, Minus, Tv, Radio, Monitor } from "lucide-react";

type Counts = { favorabil: number; neutru: number; defavorabil: number };
type ChannelCounts = { presa: Counts; tv: Counts; radio: Counts };

const emptyCounts = (): Counts => ({ favorabil: 0, neutru: 0, defavorabil: 0 });

export default function MonitorizareStatisticiPage() {
  const { db } = initFirebase();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [yearTotals, setYearTotals] = useState<ChannelCounts>({ presa: emptyCounts(), tv: emptyCounts(), radio: emptyCounts() });
  const [months, setMonths] = useState<{ month: number; counts: ChannelCounts }[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { judetId, structuraId } = getTenantContext();
        const base = collection(doc(db, `Judete/${judetId}/Structuri/${structuraId}`), "MonitorizarePresa");

        // Year totals per channel/sentiment
        const channels = ["presa", "tv", "radio"] as const;
        const sentiments = ["favorabil", "neutru", "defavorabil"] as const;
        const yStart = new Date(year, 0, 1); const yEnd = new Date(year, 11, 31, 23, 59, 59, 999);
        const totals: ChannelCounts = { presa: emptyCounts(), tv: emptyCounts(), radio: emptyCounts() };
        await Promise.all(channels.flatMap((c) => sentiments.map(async (s) => {
          const q = query(base, where("canal", "==", c), where("sentiment", "==", s), where("dataTimestamp", ">=", yStart), where("dataTimestamp", "<=", yEnd));
          const snap = await getCountFromServer(q);
          (totals as any)[c][s] = snap.data().count;
        })));
        setYearTotals(totals);

        // Per-month
        const monthResults: { month: number; counts: ChannelCounts }[] = [];
        for (let i = 0; i < 12; i++) {
          const mStart = new Date(year, i, 1); const mEnd = new Date(year, i + 1, 0, 23, 59, 59, 999);
          const cc: ChannelCounts = { presa: emptyCounts(), tv: emptyCounts(), radio: emptyCounts() };
          await Promise.all(channels.flatMap((c) => sentiments.map(async (s) => {
            const q = query(base, where("canal", "==", c), where("sentiment", "==", s), where("dataTimestamp", ">=", mStart), where("dataTimestamp", "<=", mEnd));
            const snap = await getCountFromServer(q);
            (cc as any)[c][s] = snap.data().count;
          })));
          monthResults.push({ month: i, counts: cc });
        }
        setMonths(monthResults);
      } finally {
        setLoading(false);
      }
    })();
  }, [db, year]);

  const getCanalIcon = (canal: string) => {
    switch (canal) {
      case "tv": return <Tv size={16} className="text-purple-600" />;
      case "radio": return <Radio size={16} className="text-orange-600" />;
      default: return <Monitor size={16} className="text-blue-600" />;
    }
  };

  const getCanalColor = (canal: string) => {
    switch (canal) {
      case "tv": return "from-purple-500 to-purple-600";
      case "radio": return "from-orange-500 to-orange-600";
      default: return "from-blue-500 to-blue-600";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header modern */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-2xl font-semibold tracking-tight text-gray-900 inline-flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <BarChart3 size={18} className="text-white" />
            </div>
            Statistici Monitorizare Presă
          </div>
          <div className="text-sm text-gray-600 mt-1">Analiză detaliată pe canale și sentimente pentru {year}</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg bg-white">
            <Calendar size={16} className="text-gray-700" />
            <select 
              value={year} 
              onChange={(e)=>setYear(Number(e.target.value))} 
              className="outline-none bg-transparent font-medium"
            >
              {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Channel Totals */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ChannelCard title="Presa/Online" icon={<Monitor size={20} />} color="blue" data={yearTotals.presa} loading={loading} />
        <ChannelCard title="Televiziune" icon={<Tv size={20} />} color="purple" data={yearTotals.tv} loading={loading} />
        <ChannelCard title="Radio" icon={<Radio size={20} />} color="orange" data={yearTotals.radio} loading={loading} />
      </div>

      {/* Monthly Breakdown */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-600" />
            <h3 className="font-medium text-gray-900">Repartiție lunară {year}</h3>
          </div>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                  <div className="h-4 w-16 bg-gray-200 animate-pulse mb-3 rounded"/>
                  <div className="space-y-2">
                    <div className="h-3 w-full bg-gray-200 animate-pulse rounded"/>
                    <div className="h-3 w-full bg-gray-200 animate-pulse rounded"/>
                    <div className="h-3 w-full bg-gray-200 animate-pulse rounded"/>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {months.map((m) => (
                <div key={m.month} className="rounded-xl border border-gray-200 p-4 bg-gradient-to-br from-gray-50 to-white hover:shadow-lg transition-shadow">
                  <div className="text-sm font-medium text-gray-900 mb-3 text-center">{labelMonth(m.month)}</div>
                  <MiniCounts cc={m.counts} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChannelCard({ title, icon, color, data, loading }: { title: string; icon: React.ReactNode; color: string; data: Counts; loading: boolean }) {
  const getColorClasses = (color: string) => {
    switch (color) {
      case "purple": return { bg: "from-purple-500 to-purple-600", border: "border-purple-200" };
      case "orange": return { bg: "from-orange-500 to-orange-600", border: "border-orange-200" };
      default: return { bg: "from-blue-500 to-blue-600", border: "border-blue-200" };
    }
  };

  const colors = getColorClasses(color);
  const total = data.favorabil + data.neutru + data.defavorabil;

  return (
    <div className={`rounded-2xl border ${colors.border} bg-white shadow-sm hover:shadow-lg transition-shadow`}>
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 bg-gradient-to-br ${colors.bg} rounded-xl flex items-center justify-center text-white`}>
            {icon}
          </div>
          <div>
            <div className="font-medium text-gray-900">{title}</div>
            <div className="text-sm text-gray-600">Total: {loading ? "—" : total}</div>
          </div>
        </div>
      </div>
      <div className="p-6">
        {loading ? (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="h-4 w-20 bg-gray-200 animate-pulse rounded"/>
              <div className="h-6 w-8 bg-gray-200 animate-pulse rounded"/>
            </div>
            <div className="flex justify-between items-center">
              <div className="h-4 w-16 bg-gray-200 animate-pulse rounded"/>
              <div className="h-6 w-8 bg-gray-200 animate-pulse rounded"/>
            </div>
            <div className="flex justify-between items-center">
              <div className="h-4 w-24 bg-gray-200 animate-pulse rounded"/>
              <div className="h-6 w-8 bg-gray-200 animate-pulse rounded"/>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <ThumbsUp size={14} className="text-green-600" />
                Favorabile
              </div>
              <div className="text-lg font-semibold text-green-600">{data.favorabil}</div>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <Minus size={14} className="text-gray-600" />
                Neutre
              </div>
              <div className="text-lg font-semibold text-gray-600">{data.neutru}</div>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <ThumbsDown size={14} className="text-red-600" />
                Defavorabile
              </div>
              <div className="text-lg font-semibold text-red-600">{data.defavorabil}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniCounts({ cc }: { cc: ChannelCounts }) {
  return (
    <div className="text-xs space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-gray-600">
          <Monitor size={10} />
          <span>Presă</span>
        </div>
        <div className="flex gap-1">
          <span className="text-green-600 font-medium">{cc.presa.favorabil}</span>
          <span className="text-gray-400">•</span>
          <span className="text-gray-600 font-medium">{cc.presa.neutru}</span>
          <span className="text-gray-400">•</span>
          <span className="text-red-600 font-medium">{cc.presa.defavorabil}</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-gray-600">
          <Tv size={10} />
          <span>TV</span>
        </div>
        <div className="flex gap-1">
          <span className="text-green-600 font-medium">{cc.tv.favorabil}</span>
          <span className="text-gray-400">•</span>
          <span className="text-gray-600 font-medium">{cc.tv.neutru}</span>
          <span className="text-gray-400">•</span>
          <span className="text-red-600 font-medium">{cc.tv.defavorabil}</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-gray-600">
          <Radio size={10} />
          <span>Radio</span>
        </div>
        <div className="flex gap-1">
          <span className="text-green-600 font-medium">{cc.radio.favorabil}</span>
          <span className="text-gray-400">•</span>
          <span className="text-gray-600 font-medium">{cc.radio.neutru}</span>
          <span className="text-gray-400">•</span>
          <span className="text-red-600 font-medium">{cc.radio.defavorabil}</span>
        </div>
      </div>
    </div>
  );
}

function labelMonth(m: number) {
  return ["Ian","Feb","Mar","Apr","Mai","Iun","Iul","Aug","Sep","Oct","Noi","Dec"][m] || String(m+1);
}


