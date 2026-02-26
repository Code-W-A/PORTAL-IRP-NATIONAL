"use client";

import { Search, CalendarPlus2, ChevronLeft, ChevronRight, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ActivityFilters, CalendarView } from "@/app/(admin-irp)/calendar-activitati/types";

type CalendarToolbarProps = {
  currentTitle: string;
  currentView: CalendarView;
  filters: ActivityFilters;
  categories: string[];
  locations: string[];
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  onViewChange: (view: CalendarView) => void;
  onAddActivity: () => void;
  onImportIcs: () => void;
  onFiltersChange: (patch: Partial<ActivityFilters>) => void;
};

const VIEW_OPTIONS: Array<{ value: CalendarView; label: string }> = [
  { value: "dayGridMonth", label: "Month" },
  { value: "timeGridWeek", label: "Week" },
  { value: "timeGridDay", label: "Day" },
  { value: "listWeek", label: "Agenda" },
];

export default function CalendarToolbar({
  currentTitle,
  currentView,
  filters,
  categories,
  locations,
  onToday,
  onPrev,
  onNext,
  onViewChange,
  onAddActivity,
  onImportIcs,
  onFiltersChange,
}: CalendarToolbarProps) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm text-gray-500">Vizualizare curentă</div>
          <div className="text-lg font-semibold text-gray-900">{currentTitle}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={onImportIcs}>
            <Upload className="h-4 w-4" />
            Import .ics
          </Button>

          <Button onClick={onAddActivity}>
            <CalendarPlus2 className="h-4 w-4" />
            Adaugă activitate
          </Button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[1.1fr_1fr_1fr]">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {VIEW_OPTIONS.map((item) => (
              <Button
                key={item.value}
                variant={currentView === item.value ? "default" : "outline"}
                size="sm"
                onClick={() => onViewChange(item.value)}
              >
                {item.label}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onPrev}>
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <Button variant="outline" size="sm" onClick={onToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={onNext}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Caută titlu sau descriere</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              className="pl-8"
              value={filters.search}
              onChange={(event) => onFiltersChange({ search: event.target.value })}
              placeholder="Ex: ședință"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Categorie</label>
            <select
              value={filters.category}
              onChange={(event) => onFiltersChange({ category: event.target.value })}
              className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
            >
              <option value="">Toate</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Locație</label>
            <select
              value={filters.location}
              onChange={(event) => onFiltersChange({ location: event.target.value })}
              className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
            >
              <option value="">Toate</option>
              {locations.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Status</label>
            <select
              value={filters.status}
              onChange={(event) =>
                onFiltersChange({
                  status: event.target.value as ActivityFilters["status"],
                })
              }
              className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
            >
              <option value="all">Toate</option>
              <option value="upcoming">Upcoming</option>
              <option value="ongoing">Ongoing</option>
              <option value="past">Past</option>
            </select>
          </div>
        </div>
      </div>
    </section>
  );
}
