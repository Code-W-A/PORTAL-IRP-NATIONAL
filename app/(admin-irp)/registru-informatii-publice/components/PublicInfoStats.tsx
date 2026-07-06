"use client";

import type { PublicInfoStats } from "@/app/(admin-irp)/registru-informatii-publice/_core/stats";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PublicInfoStatsProps = {
  open: boolean;
  stats: PublicInfoStats;
  onOpenChange: (open: boolean) => void;
};

export default function PublicInfoStatsPanel({ open, stats, onOpenChange }: PublicInfoStatsProps) {
  const maxMonthly = Math.max(...stats.monthlyTotals.map((item) => item.total), 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Statistici registru informații publice</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Total solicitări" value={stats.total} />
          <StatCard label="Solicitări scrise" value={stats.written} />
          <StatCard label="Solicitări verbale" value={stats.verbal} />
          <StatCard
            label="Medie termen (zile)"
            value={stats.averageTermDays ?? "—"}
          />
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900">Natura răspunsului</h3>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {Object.entries(stats.byResponseNature).map(([label, count]) => (
              <div key={label} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm">
                <span>{label}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900">Top domenii / modalități</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <TopList title="Domenii de interes" items={stats.topInterestDomains} />
            <TopList title="Modalități primire" items={stats.topReceiveMethods} />
            <TopList title="Moduri comunicare" items={stats.topCommunicationMethods} />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Solicitări pe luni</h3>
          <div className="space-y-2">
            {stats.monthlyTotals.map((item) => (
              <div key={item.month} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>{item.month}</span>
                  <span>
                    {item.total} total · {item.written} scrise · {item.verbal} verbale
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-blue-600"
                    style={{ width: `${Math.max(6, (item.total / maxMonthly) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-900">Sumar anual</h3>
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2">An</th>
                  <th className="px-3 py-2">Total</th>
                  <th className="px-3 py-2">Scrise</th>
                  <th className="px-3 py-2">Verbale</th>
                </tr>
              </thead>
              <tbody>
                {stats.yearlyTotals.map((item) => (
                  <tr key={item.year} className="border-t border-gray-100">
                    <td className="px-3 py-2">{item.year}</td>
                    <td className="px-3 py-2">{item.total}</td>
                    <td className="px-3 py-2">{item.written}</td>
                    <td className="px-3 py-2">{item.verbal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function TopList({ title, items }: { title: string; items: Array<{ label: string; count: number }> }) {
  return (
    <div className="rounded-xl border border-gray-200 p-3">
      <div className="mb-2 text-sm font-medium text-gray-900">{title}</div>
      <div className="space-y-1 text-sm text-gray-700">
        {items.length ? (
          items.map((item) => (
            <div key={item.label} className="flex justify-between gap-2">
              <span className="truncate">{item.label}</span>
              <strong>{item.count}</strong>
            </div>
          ))
        ) : (
          <div className="text-gray-500">—</div>
        )}
      </div>
    </div>
  );
}
