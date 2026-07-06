"use client";

import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { PublicInfoRequestFilters } from "@/app/(admin-irp)/registru-informatii-publice/_core/types";

type PublicInfoFiltersProps = {
  filters: PublicInfoRequestFilters;
  years: string[];
  months: string[];
  responseNatures: string[];
  receiveMethods: string[];
  interestDomains: string[];
  onChange: (patch: Partial<PublicInfoRequestFilters>) => void;
};

export default function PublicInfoFilters({
  filters,
  years,
  months,
  responseNatures,
  receiveMethods,
  interestDomains,
  onChange,
}: PublicInfoFiltersProps) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.2fr_repeat(5,minmax(0,1fr))]">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-600">Căutare globală</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              className="pl-8"
              value={filters.search}
              onChange={(event) => onChange({ search: event.target.value })}
              placeholder="Nume, număr cerere, domeniu..."
            />
          </div>
        </div>

        <SelectField label="An" value={filters.year} onChange={(value) => onChange({ year: value })}>
          <option value="">Toți</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </SelectField>

        <SelectField label="Lună" value={filters.month} onChange={(value) => onChange({ month: value })}>
          <option value="">Toate</option>
          {months.map((month) => (
            <option key={month} value={month}>
              {month}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Natura răspunsului"
          value={filters.responseNature}
          onChange={(value) => onChange({ responseNature: value })}
        >
          <option value="">Toate</option>
          {responseNatures.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Modalitate primire"
          value={filters.receiveMethod}
          onChange={(value) => onChange({ receiveMethod: value })}
        >
          <option value="">Toate</option>
          {receiveMethods.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Domeniu interes"
          value={filters.interestDomain}
          onChange={(value) => onChange({ interestDomain: value })}
        >
          <option value="">Toate</option>
          {interestDomains.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </SelectField>
      </div>
    </section>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm"
      >
        {children}
      </select>
    </div>
  );
}
