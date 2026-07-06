import type { PublicInfoRequest } from "./types";

const NUMBER_PATTERN = /^(\d+)\s*\/\s*(\d{4})$/;

export function parseRequestNumber(value: string) {
  const match = String(value || "").trim().match(NUMBER_PATTERN);
  if (!match) return null;
  return {
    sequence: Number(match[1]),
    year: Number(match[2]),
  };
}

export function suggestNextRequestNumber(
  requests: PublicInfoRequest[],
  year = new Date().getFullYear()
): string {
  let maxSequence = 0;

  for (const item of requests) {
    const parsed = parseRequestNumber(item.requestNumber);
    if (!parsed || parsed.year !== year) continue;
    maxSequence = Math.max(maxSequence, parsed.sequence);
  }

  return `${maxSequence + 1}/${year}`;
}
