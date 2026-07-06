import type { PublicInfoRequestDraft } from "./types";

function removeDiacritics(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

function tokenize(value: string) {
  const normalized = removeDiacritics(String(value || "").toLowerCase().trim());
  if (!normalized) return [];
  return normalized
    .split(/[^a-z0-9@./]+/g)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
}

function dateParts(isoDate: string) {
  const parsed = Date.parse(isoDate);
  if (!Number.isFinite(parsed)) return { year: "", month: "" };
  const date = new Date(parsed);
  return {
    year: String(date.getFullYear()),
    month: String(date.getMonth() + 1).padStart(2, "0"),
  };
}

export function buildSearchKeywords(input: Partial<PublicInfoRequestDraft>): string[] {
  const parts = [
    input.requestNumber,
    input.requestDate,
    input.requestType,
    input.receiveMethod,
    input.requesterName,
    input.requesterType,
    input.requestedInformation,
    input.interestDomain,
    input.responseNature,
    input.communicationMethod,
    input.responseNumber,
    input.responseDate,
    input.internalNotes,
  ];

  const requestParts = dateParts(String(input.requestDate || ""));
  const responseParts = dateParts(String(input.responseDate || ""));

  for (const chunk of parts) {
    parts.push(...tokenize(String(chunk || "")));
  }

  parts.push(requestParts.year, requestParts.month, responseParts.year, responseParts.month);

  return Array.from(new Set(parts.flatMap((value) => tokenize(String(value || "")))));
}

export function matchesSearchQuery(keywords: string[], query: string) {
  const tokens = tokenize(query);
  if (!tokens.length) return true;
  const haystack = keywords.join(" ");
  return tokens.every((token) => haystack.includes(token));
}
