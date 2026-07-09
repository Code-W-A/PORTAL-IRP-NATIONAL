"use client";

import { CalendarRange } from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";

import { ACTIVITATI_IMPACT_TYPE_ID } from "@/app/(admin-irp)/dashboard/raportari/_core/templates/activitatiImpact";
import type { PeriodPreset } from "@/app/(admin-irp)/dashboard/raportari/_core/types";
import { formatPeriodRangeLabel } from "@/app/(admin-irp)/dashboard/raportari/_core/title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Props = {
  periodPreset: PeriodPreset;
  periodStart: string;
  periodEnd: string;
  lastPeriodStart?: string;
  lastPeriodEnd?: string;
  typeId?: string;
  onPresetChange: (preset: PeriodPreset) => void;
  onPeriodChange: (field: "start" | "end", value: string) => void;
};

function getPresetOptions(typeId?: string): Array<{ value: PeriodPreset; label: string }> {
  const isImpact = typeId === ACTIVITATI_IMPACT_TYPE_ID;
  return [
    {
      value: "next_week",
      label: isImpact ? "Perioada următoare" : "Săptămâna următoare",
    },
    {
      value: "previous_week",
      label: isImpact ? "Perioada anterioară" : "Săptămâna anterioară",
    },
    { value: "custom", label: "Personalizat" },
  ];
}

function getPeriodDurationDays(start: string, end: string): number | null {
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      return null;
    }
    const days = differenceInCalendarDays(parseISO(end), parseISO(start));
    return days >= 0 ? days + 1 : null;
  } catch {
    return null;
  }
}

export default function ReportPeriodSelector({
  periodPreset,
  periodStart,
  periodEnd,
  lastPeriodStart,
  lastPeriodEnd,
  typeId,
  onPresetChange,
  onPeriodChange,
}: Props) {
  const hasLastPeriod = Boolean(lastPeriodStart && lastPeriodEnd);
  const periodLabel = formatPeriodRangeLabel(periodStart, periodEnd);
  const presetOptions = getPresetOptions(typeId);
  const lastDurationDays =
    hasLastPeriod && lastPeriodStart && lastPeriodEnd
      ? getPeriodDurationDays(lastPeriodStart, lastPeriodEnd)
      : null;
  const isImpact = typeId === ACTIVITATI_IMPACT_TYPE_ID;

  return (
    <Card className="border-blue-200 bg-blue-50/40">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <CalendarRange className="mt-0.5 h-4 w-4 text-blue-700" />
            <div>
              <div className="font-medium text-blue-900">Perioada raportării</div>
              <div className="text-sm text-blue-800">{periodLabel}</div>
              {hasLastPeriod ? (
                <div className="mt-1 text-xs text-blue-700">
                  Ultima raportare: {formatPeriodRangeLabel(lastPeriodStart!, lastPeriodEnd!)}
                  {isImpact && lastDurationDays ? (
                    <span> · Următoarea perioadă propusă are aceeași durată ({lastDurationDays} zile)</span>
                  ) : null}
                </div>
              ) : (
                <div className="mt-1 text-xs text-blue-700">Prima raportare — perioada curentă este propusă automat.</div>
              )}
            </div>
          </div>
          <Badge variant="secondary">{periodPreset === "custom" ? "Personalizat" : "Propus"}</Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          {presetOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={periodPreset === option.value ? "default" : "outline"}
              onClick={() => onPresetChange(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="report-period-start">
              Data început
            </label>
            <Input
              id="report-period-start"
              type="date"
              value={periodStart}
              onChange={(event) => onPeriodChange("start", event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700" htmlFor="report-period-end">
              Data sfârșit
            </label>
            <Input
              id="report-period-end"
              type="date"
              value={periodEnd}
              onChange={(event) => onPeriodChange("end", event.target.value)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
