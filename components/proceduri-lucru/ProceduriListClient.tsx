"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { Procedure } from "@/lib/proceduri-lucru/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

type ProceduriListClientProps = {
  procedures: Procedure[];
};

const statusLabelMap: Record<Procedure["status"], string> = {
  active: "Activ",
  draft: "Draft",
  deprecated: "Deprecat",
};

const statusClassMap: Record<Procedure["status"], string> = {
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  draft: "bg-amber-100 text-amber-700 border-amber-200",
  deprecated: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function ProceduriListClient({ procedures }: ProceduriListClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const categories = useMemo(() => {
    const items = new Set<string>();
    procedures.forEach((procedure) => items.add(procedure.category));
    return Array.from(items).sort();
  }, [procedures]);

  const filteredProcedures = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return procedures.filter((procedure) => {
      const matchesCategory = categoryFilter === "all" || procedure.category === categoryFilter;
      const matchesStatus = statusFilter === "all" || procedure.status === statusFilter;
      const matchesSearch =
        !query ||
        procedure.title.toLowerCase().includes(query) ||
        procedure.summary.toLowerCase().includes(query) ||
        (procedure.tags || []).some((tag) => tag.toLowerCase().includes(query));
      return matchesCategory && matchesStatus && matchesSearch;
    });
  }, [procedures, searchQuery, categoryFilter, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:flex-row md:items-center">
        <div className="flex-1">
          <Input
            placeholder="Caută după titlu, sumar sau taguri"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row md:w-auto">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Categorie" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toate categoriile</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toate statusurile</SelectItem>
              <SelectItem value="active">Activ</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="deprecated">Deprecat</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {filteredProcedures.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Nu există rezultate</CardTitle>
          </CardHeader>
          <CardContent>
            Ajustează căutarea sau filtrele pentru a găsi proceduri relevante.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredProcedures.map((procedure) => (
            <Link key={procedure.slug} href={`/proceduri-lucru/${procedure.slug}`} className="block">
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge className={statusClassMap[procedure.status]}>
                      {statusLabelMap[procedure.status]}
                    </Badge>
                    <Badge variant="outline">{procedure.category}</Badge>
                  </div>
                  <CardTitle className="text-lg">{procedure.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-gray-600">{procedure.summary}</p>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Actualizat: {procedure.updatedAt}</span>
                    {procedure.owner && <span>{procedure.owner}</span>}
                  </div>
                  {procedure.tags && procedure.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {procedure.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="bg-gray-50 text-gray-600">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
