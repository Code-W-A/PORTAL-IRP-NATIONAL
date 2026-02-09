export type ProcedureStatus = "active" | "draft" | "deprecated";

export type ProcedureStep = {
  id: string;
  title: string;
  details?: string;
  mustDo?: boolean;
};

export type Procedure = {
  slug: string;
  title: string;
  summary: string;
  category: string;
  status: ProcedureStatus;
  updatedAt: string;
  owner?: string;
  tags?: string[];
  contentMarkdown: string;
  steps?: ProcedureStep[];
};

