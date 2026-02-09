"use client";

import { useEffect, useMemo, useState } from "react";

import type { ProcedureStep } from "@/lib/proceduri-lucru/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";

type ProcedureExecutionProps = {
  slug: string;
  steps?: ProcedureStep[];
};

export default function ProcedureExecution({ slug, steps }: ProcedureExecutionProps) {
  const safeSteps = steps ?? [];
  const storageKey = slug;
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCompletedIds(parsed);
        }
      }
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(completedIds));
    } catch {}
  }, [storageKey, completedIds]);

  const progressValue = useMemo(() => {
    if (safeSteps.length === 0) return 0;
    return Math.round((completedIds.length / safeSteps.length) * 100);
  }, [safeSteps.length, completedIds.length]);

  function toggleStep(stepId: string) {
    setCompletedIds((prev) => {
      if (prev.includes(stepId)) {
        return prev.filter((id) => id !== stepId);
      }
      return [...prev, stepId];
    });
  }

  function resetSteps() {
    setCompletedIds([]);
  }

  if (safeSteps.length === 0) {
    return <div className="text-sm text-gray-500">Nu există pași definiți pentru această procedură.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm text-gray-600">Progres</div>
            <div className="text-2xl font-semibold text-gray-900">{progressValue}%</div>
          </div>
          <Button variant="outline" onClick={resetSteps}>
            Reset
          </Button>
        </div>
        <div className="mt-4">
          <Progress value={progressValue} />
        </div>
      </div>

      <div className="space-y-4">
        {safeSteps.map((step, index) => {
          const isChecked = completedIds.includes(step.id);
          return (
            <div key={step.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-start gap-4">
                <div className="pt-1">
                  <Checkbox checked={isChecked} onCheckedChange={() => toggleStep(step.id)} />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-gray-500">Pas {index + 1}</span>
                    {step.mustDo && <Badge className="bg-red-100 text-red-700 border-red-200">Obligatoriu</Badge>}
                  </div>
                  <div className="text-base font-semibold text-gray-900">{step.title}</div>
                  {step.details && <div className="text-sm text-gray-600">{step.details}</div>}
                </div>
              </div>
              <Separator className="mt-4" />
              <div className="mt-3 text-xs text-gray-500">
                {isChecked ? "Marcat ca finalizat" : "În așteptare"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

