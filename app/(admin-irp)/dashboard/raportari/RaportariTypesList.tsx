"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { useMemo } from "react";

import { useRaportariData } from "@/app/(admin-irp)/dashboard/raportari/_core/useRaportariData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RaportariTypesList() {
  const { types, reports, loadingTypes, error } = useRaportariData();

  const countsByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const report of reports) {
      map.set(report.typeId, (map.get(report.typeId) || 0) + 1);
    }
    return map;
  }, [reports]);

  if (loadingTypes) {
    return <div className="text-sm text-gray-500">Se încarcă tipurile de raportare...</div>;
  }

  if (!types.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nu există tipuri de raportare configurate</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600">
          Tipurile se definesc din cod. Repornește aplicația sau contactează administratorul.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Raportări</h1>
        <p className="mt-1 text-sm text-gray-600">Alege tipul de raportare pentru a vedea raportările salvate.</p>
      </div>

      {error ? <div className="text-sm text-red-600">{error}</div> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {types.map((type) => {
          const count = countsByType.get(type.id) || 0;
          return (
            <Link key={type.id} href={`/dashboard/raportari/${type.id}`} className="block">
              <Card className="h-full transition hover:border-blue-300 hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-lg">{type.name}</CardTitle>
                      <CardDescription className="mt-1 line-clamp-3">{type.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-gray-600">
                  {count === 0 ? "Nicio raportare salvată" : `${count} raportări salvate`}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
