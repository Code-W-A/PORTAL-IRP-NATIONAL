import type { SituationDraft } from "./types";

export class GuideError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}
export function searchText(draft: SituationDraft) {
  return normalizeSearch([draft.question, draft.answer, ...draft.followUps.flatMap(p => [p.question, p.answer])].join(" "));
}
export function matchesSearch(text: string, query: string) {
  return normalizeSearch(query).split(/\s+/).filter(Boolean).every(word => text.includes(word));
}
function requiredText(value: unknown, label: string, max: number) {
  if (typeof value !== "string" || !value.trim()) throw new GuideError(400, `Completează ${label}.`);
  if (value.length > max) throw new GuideError(400, `${label} poate avea cel mult ${max} de caractere.`);
  return value.trim();
}
export function validateSituation(value: unknown): SituationDraft {
  const input = value as Partial<SituationDraft> | null;
  if (!input || typeof input !== "object") throw new GuideError(400, "Datele trimise nu sunt valide.");
  if (input.followUps !== undefined && !Array.isArray(input.followUps)) throw new GuideError(400, "Continuările nu sunt valide.");
  const pairs = input.followUps || [];
  if (pairs.length > 30) throw new GuideError(400, "Poți adăuga cel mult 30 de întrebări suplimentare.");
  return {
    question: requiredText(input.question, "întrebarea", 1000),
    answer: requiredText(input.answer, "răspunsul", 20000),
    followUps: pairs.map(pair => ({
      question: requiredText(pair?.question, "întrebarea suplimentară", 1000),
      answer: requiredText(pair?.answer, "răspunsul suplimentar", 10000),
    })),
  };
}
export function validateCompletion(value: unknown) {
  return requiredText((value as { text?: unknown } | null)?.text, "completarea", 10000);
}
export function validateId(value: unknown): string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) throw new GuideError(400, "Identificator invalid.");
  return value;
}
export function validateCreationId(value: unknown) {
  const id = validateId(value);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new GuideError(400, "Identificator de publicare invalid.");
  return id;
}
