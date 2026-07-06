import type { PublicInfoRequest, PublicInfoRequestFilters } from "./types";
import { matchesSearchQuery } from "./searchKeywords";

export type PublicInfoStats = {
  total: number;
  written: number;
  verbal: number;
  byResponseNature: Record<string, number>;
  averageTermDays: number | null;
  topInterestDomains: Array<{ label: string; count: number }>;
  topReceiveMethods: Array<{ label: string; count: number }>;
  topCommunicationMethods: Array<{ label: string; count: number }>;
  monthlyTotals: Array<{ month: string; written: number; verbal: number; total: number }>;
  yearlyTotals: Array<{ year: string; written: number; verbal: number; total: number }>;
};

function monthKey(isoDate: string) {
  const parsed = Date.parse(isoDate);
  if (!Number.isFinite(parsed)) return "";
  const date = new Date(parsed);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function yearKey(isoDate: string) {
  const parsed = Date.parse(isoDate);
  if (!Number.isFinite(parsed)) return "";
  return String(new Date(parsed).getFullYear());
}

function increment(map: Record<string, number>, key: string) {
  if (!key) return;
  map[key] = (map[key] || 0) + 1;
}

function topEntries(map: Record<string, number>, limit = 5) {
  return Object.entries(map)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ro"))
    .slice(0, limit);
}

export function filterPublicInfoRequests(
  requests: PublicInfoRequest[],
  filters: PublicInfoRequestFilters
) {
  return requests.filter((item) => {
    if (filters.requestType === "written" && item.requestType !== "written") return false;
    if (filters.requestType === "verbal" && item.requestType !== "verbal") return false;

    if (filters.year && yearKey(item.requestDate) !== filters.year) return false;
    if (filters.month && monthKey(item.requestDate) !== filters.month) return false;
    if (filters.responseNature && item.responseNature !== filters.responseNature) return false;
    if (filters.receiveMethod && item.receiveMethod !== filters.receiveMethod) return false;
    if (filters.interestDomain && item.interestDomain !== filters.interestDomain) return false;
    if (filters.search && !matchesSearchQuery(item.searchKeywords, filters.search)) return false;

    return true;
  });
}

export function computePublicInfoStats(requests: PublicInfoRequest[]): PublicInfoStats {
  const byResponseNature: Record<string, number> = {};
  const interestDomains: Record<string, number> = {};
  const receiveMethods: Record<string, number> = {};
  const communicationMethods: Record<string, number> = {};
  const monthlyMap: Record<string, { written: number; verbal: number; total: number }> = {};
  const yearlyMap: Record<string, { written: number; verbal: number; total: number }> = {};

  let written = 0;
  let verbal = 0;
  let termSum = 0;
  let termCount = 0;

  for (const item of requests) {
    if (item.requestType === "written") written += 1;
    if (item.requestType === "verbal") verbal += 1;

    increment(byResponseNature, item.responseNature || "nespecificat");
    increment(interestDomains, item.interestDomain || "nespecificat");
    increment(receiveMethods, item.receiveMethod || "nespecificat");
    increment(communicationMethods, item.communicationMethod || "nespecificat");

    if (typeof item.termDays === "number" && !Number.isNaN(item.termDays)) {
      termSum += item.termDays;
      termCount += 1;
    }

    const month = monthKey(item.requestDate);
    const year = yearKey(item.requestDate);

    if (month) {
      monthlyMap[month] ||= { written: 0, verbal: 0, total: 0 };
      monthlyMap[month].total += 1;
      if (item.requestType === "written") monthlyMap[month].written += 1;
      if (item.requestType === "verbal") monthlyMap[month].verbal += 1;
    }

    if (year) {
      yearlyMap[year] ||= { written: 0, verbal: 0, total: 0 };
      yearlyMap[year].total += 1;
      if (item.requestType === "written") yearlyMap[year].written += 1;
      if (item.requestType === "verbal") yearlyMap[year].verbal += 1;
    }
  }

  return {
    total: requests.length,
    written,
    verbal,
    byResponseNature,
    averageTermDays: termCount ? Math.round((termSum / termCount) * 10) / 10 : null,
    topInterestDomains: topEntries(interestDomains),
    topReceiveMethods: topEntries(receiveMethods),
    topCommunicationMethods: topEntries(communicationMethods),
    monthlyTotals: Object.entries(monthlyMap)
      .map(([month, values]) => ({ month, ...values }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    yearlyTotals: Object.entries(yearlyMap)
      .map(([year, values]) => ({ year, ...values }))
      .sort((a, b) => a.year.localeCompare(b.year)),
  };
}

export function formatRequestDateLabel(isoDate: string) {
  const parsed = Date.parse(isoDate);
  if (!Number.isFinite(parsed)) return "—";
  return new Date(parsed).toLocaleDateString("ro-RO");
}

export function formatRequestNumberDate(item: PublicInfoRequest) {
  const dateLabel = formatRequestDateLabel(item.requestDate);
  return item.requestNumber ? `${item.requestNumber} / ${dateLabel}` : dateLabel;
}

export function formatResponseNumberDate(item: PublicInfoRequest) {
  if (!item.responseNumber && !item.responseDate) return "—";
  const dateLabel = item.responseDate ? formatRequestDateLabel(item.responseDate) : "—";
  return item.responseNumber ? `${item.responseNumber} / ${dateLabel}` : dateLabel;
}
