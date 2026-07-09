"use client";

import { ExternalLink, Search } from "lucide-react";
import { useMemo, useState } from "react";

import {
  buildEvidentaRows,
  filterEvidentaRows,
  filterEvidentaRowsByDate,
  formatEvidentaCellValue,
  groupEvidentaRows,
  shortColumnLabel,
  type EvidentaDateFilters,
} from "@/app/(admin-irp)/dashboard/raportari/_core/evidenta";
import type { ReportInstanceDoc } from "@/app/(admin-irp)/dashboard/raportari/_core/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

type Props = {
  reports: ReportInstanceDoc[];
  typeId: string;
  typeName: string;
  loading?: boolean;
  onOpenReport: (reportId: string, fallback?: ReportInstanceDoc) => void;
};

function highlightMatch(text: string, query: string) {
  const normalized = query.trim();
  if (!normalized) return text;
  const index = text.toLowerCase().indexOf(normalized.toLowerCase());
  if (index < 0) return text;

  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-amber-100 px-0.5">{text.slice(index, index + normalized.length)}</mark>
      {text.slice(index + normalized.length)}
    </>
  );
}

export default function ReportEvidentaPanel({
  reports,
  typeId,
  typeName,
  loading,
  onOpenReport,
}: Props) {
  const [query, setQuery] = useState("");
  const [dateFilters, setDateFilters] = useState<EvidentaDateFilters>({});

  const typeReports = useMemo(
    () => reports.filter((report) => report.typeId === typeId),
    [reports, typeId]
  );

  const allEntries = useMemo(() => buildEvidentaRows(reports, typeId), [reports, typeId]);
  const filteredByText = useMemo(() => filterEvidentaRows(allEntries, query), [allEntries, query]);
  const filteredEntries = useMemo(
    () => filterEvidentaRowsByDate(filteredByText, dateFilters),
    [filteredByText, dateFilters]
  );
  const groupedReports = useMemo(() => groupEvidentaRows(filteredEntries), [filteredEntries]);

  const totalRows = allEntries.length;
  const filteredRows = filteredEntries.length;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Evidență {typeName}</h3>
            <p className="mt-1 text-sm text-gray-600">
              Caută în toate raportările salvate — activități, modalități, perioade, persoane și observații.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{typeReports.length} raportări</Badge>
            <Badge variant="secondary">{totalRows} activități</Badge>
            {query.trim() ? <Badge>{filteredRows} rezultate</Badge> : null}
          </div>
        </div>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Caută activitate, modalitate, perioadă, persoană, observație..."
            className="pl-9"
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Perioadă raport de la</label>
            <Input
              type="date"
              value={dateFilters.reportFrom || ""}
              onChange={(event) =>
                setDateFilters((previous) => ({ ...previous, reportFrom: event.target.value || undefined }))
              }
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Perioadă raport până la</label>
            <Input
              type="date"
              value={dateFilters.reportTo || ""}
              onChange={(event) =>
                setDateFilters((previous) => ({ ...previous, reportTo: event.target.value || undefined }))
              }
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Dată activitate de la</label>
            <Input
              type="date"
              value={dateFilters.rowFrom || ""}
              onChange={(event) =>
                setDateFilters((previous) => ({ ...previous, rowFrom: event.target.value || undefined }))
              }
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Dată activitate până la</label>
            <Input
              type="date"
              value={dateFilters.rowTo || ""}
              onChange={(event) =>
                setDateFilters((previous) => ({ ...previous, rowTo: event.target.value || undefined }))
              }
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Se încarcă evidența...</div>
      ) : typeReports.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
          Nu există raportări salvate pentru acest tip. Salvează prima raportare ca să apară aici.
        </div>
      ) : filteredRows === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
          Niciun rezultat pentru „{query.trim()}”.
        </div>
      ) : (
        <Accordion type="multiple" className="rounded-lg border border-gray-200 px-4">
          {groupedReports.map((group) => {
            const sourceReport = typeReports.find((report) => report.id === group.reportId);
            return (
              <AccordionItem key={group.reportId} value={group.reportId}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 pr-4 text-left">
                    <span className="font-semibold text-gray-900">
                      {highlightMatch(group.periodLabel, query)}
                    </span>
                    {group.registrationNumber ? (
                      <span className="text-sm text-gray-600">
                        Nr. {highlightMatch(group.registrationNumber, query)}
                      </span>
                    ) : null}
                    <Badge variant="outline">{group.rows.length} rânduri</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pb-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-gray-500">
                        Perioada {group.periodStart} – {group.periodEnd}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenReport(group.reportId, sourceReport)}
                      >
                        <ExternalLink className="h-4 w-4" />
                        Deschide raportul
                      </Button>
                    </div>

                    <ScrollArea className="max-h-[520px]">
                      <div className="overflow-x-auto rounded-lg border border-gray-200">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-100 text-gray-800">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold">Nr.</th>
                              {group.columns.map((column) => (
                                <th key={column.id} className="min-w-[160px] px-3 py-2 text-left font-semibold">
                                  {shortColumnLabel(column.label)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {group.rows.map(({ rowIndex, row }) => (
                              <tr key={row.id} className="border-t border-gray-200 align-top">
                                <td className="px-3 py-2 text-gray-500">{rowIndex + 1}</td>
                                {group.columns.map((column) => {
                                  const raw = String(row.cells[column.id] || "");
                                  const value = formatEvidentaCellValue(column, raw);
                                  if (!value.trim()) {
                                    return (
                                      <td key={`${row.id}:${column.id}`} className="px-3 py-2 text-gray-400">
                                        —
                                      </td>
                                    );
                                  }
                                  return (
                                    <td key={`${row.id}:${column.id}`} className="px-3 py-2 whitespace-pre-wrap">
                                      {highlightMatch(value, query)}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </ScrollArea>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}
