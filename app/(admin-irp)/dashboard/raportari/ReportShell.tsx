"use client";

import { useMemo, useState } from "react";
import { BookOpen, ChevronRight, Download, FileText, Plus, Save } from "lucide-react";

import type { ReportTypeDoc } from "@/app/(admin-irp)/dashboard/raportari/_core/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ShellStatus = "draft" | "saved" | "modified";

type ReportShellProps = {
  types: ReportTypeDoc[];
  activeTypeId: string;
  onSelectType: (typeId: string) => void;
  onCreateReport: () => void;
  onOpenLibrary: () => void;
  onSaveReport: () => void;
  onExportPdf: () => void;
  onExportExcel: () => void;
  saveLoading?: boolean;
  saveDisabled?: boolean;
  exportPdfLoading?: boolean;
  exportPdfDisabled?: boolean;
  exportExcelLoading?: boolean;
  exportExcelDisabled?: boolean;
  title: string;
  subtitle: string;
  status: ShellStatus;
  dirty: boolean;
  children: React.ReactNode;
};

function statusLabel(status: ShellStatus) {
  if (status === "saved") return "Salvat";
  if (status === "modified") return "Modificat";
  return "Draft";
}

function statusClassName(status: ShellStatus) {
  if (status === "saved") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "modified") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-gray-200 bg-gray-100 text-gray-700";
}

export default function ReportShell({
  types,
  activeTypeId,
  onSelectType,
  onCreateReport,
  onOpenLibrary,
  onSaveReport,
  onExportPdf,
  onExportExcel,
  saveLoading,
  saveDisabled,
  exportPdfLoading,
  exportPdfDisabled,
  exportExcelLoading,
  exportExcelDisabled,
  title,
  subtitle,
  status,
  dirty,
  children,
}: ReportShellProps) {
  const [searchValue, setSearchValue] = useState("");

  const filteredTypes = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return types;
    return types.filter((item) => {
      const text = `${item.name} ${item.description}`.toLowerCase();
      return text.includes(query);
    });
  }, [searchValue, types]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle>Tipuri raportări</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Command>
              <CommandInput
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Caută tip raport..."
              />
              <CommandList>
                {filteredTypes.length === 0 ? (
                  <CommandEmpty>Nu există rezultate.</CommandEmpty>
                ) : (
                  filteredTypes.map((item) => {
                    const isActive = item.id === activeTypeId;
                    return (
                      <CommandItem
                        key={item.id}
                        active={isActive}
                        onClick={() => onSelectType(item.id)}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{item.name}</span>
                          <span className="block truncate text-xs text-gray-500">{item.description}</span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                      </CommandItem>
                    );
                  })
                )}
              </CommandList>
            </Command>
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-4">
          <Card className="sticky top-2 z-20">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-xl font-semibold text-gray-900">{title}</h1>
                  <Badge className={statusClassName(status)}>{statusLabel(status)}</Badge>
                  {dirty && <span className="text-xs text-amber-600">Modificări nesalvate</span>}
                </div>
                <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={onCreateReport}>
                  <Plus className="h-4 w-4" />
                  Raport nou
                </Button>
                <Button variant="outline" onClick={onOpenLibrary}>
                  <BookOpen className="h-4 w-4" />
                  Bibliotecă
                </Button>
                <Button variant="outline" onClick={onSaveReport} disabled={saveDisabled}>
                  <Save className="h-4 w-4" />
                  {saveLoading ? "Se salvează..." : "Salvează"}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="default" disabled={exportPdfDisabled && exportExcelDisabled}>
                      <Download className="h-4 w-4" />
                      Exportă
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Format export</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onExportPdf} disabled={exportPdfDisabled}>
                      <FileText className="mr-2 h-4 w-4" />
                      {exportPdfLoading ? "Se exportă PDF..." : "Export PDF"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={onExportExcel} disabled={exportExcelDisabled}>
                      <Download className="mr-2 h-4 w-4" />
                      {exportExcelLoading ? "Se exportă Excel..." : "Export Excel"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>

          {children}
        </div>
      </div>
    </div>
  );
}
