export type FollowUp = { question: string; answer: string };
export type SituationDraft = { question: string; answer: string; followUps: FollowUp[]; categoryIds?: string[] };
export type GuideAuthor = { uid: string; name: string };
export type Situation = SituationDraft & {
  id: string;
  categoryIds: string[];
  author: GuideAuthor;
  status: "active" | "withdrawn";
  completionCount: number;
  createdAt: string;
  updatedAt: string;
};
export type SituationSummary = Omit<Situation, "followUps"> & { matchingQuestion?: string };
export type GuideCategory = { id: string; name: string };
export const UNCATEGORIZED = "fara-categorie";
export const MAX_CATEGORIES = 5;
export type Completion = {
  id: string;
  text: string;
  author: GuideAuthor;
  createdAt: string;
  updatedAt: string;
};
export type GuidePage<T> = { items: T[]; nextCursor: string | null };
export const WITHDRAWN_TITLE = "Situație retrasă de autor";
