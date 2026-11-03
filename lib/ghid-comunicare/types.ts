export type FollowUp = { question: string; answer: string };
export type SituationDraft = { question: string; answer: string; followUps: FollowUp[] };
export type GuideAuthor = { uid: string; name: string };
export type Situation = SituationDraft & {
  id: string;
  author: GuideAuthor;
  status: "active" | "withdrawn";
  completionCount: number;
  createdAt: string;
  updatedAt: string;
};
export type SituationSummary = Omit<Situation, "followUps">;
export type Completion = {
  id: string;
  text: string;
  author: GuideAuthor;
  createdAt: string;
  updatedAt: string;
};
export type GuidePage<T> = { items: T[]; nextCursor: string | null };
export const WITHDRAWN_TITLE = "Situație retrasă de autor";
