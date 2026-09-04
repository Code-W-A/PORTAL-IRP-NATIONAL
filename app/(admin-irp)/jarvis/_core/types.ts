export type JarvisSection =
  | "today"
  | "operativ"
  | "calendar"
  | "foia"
  | "raportari"
  | "documente";

export type JarvisSeverity = "critical" | "warn" | "watch" | "info" | "ok";

export type JarvisStatusDot = {
  id: string;
  severity: JarvisSeverity;
  label: string;
  href?: string;
};

export type JarvisUpcomingItem = {
  id: string;
  dateLabel: string;
  title: string;
  source: "calendar" | "procedure";
  href: string;
  daysAhead: number;
  location?: string;
};

export type JarvisApprovalItem = {
  id: string;
  kind: "activity" | "foia" | "media" | "operativ";
  title: string;
  detail: string;
  href: string;
  requiresHuman: boolean;
};

export type JarvisFoiaItem = {
  id: string;
  requestNumber: string;
  requesterName: string;
  receivedAtLabel: string;
  status: string;
  deadlineLabel: string;
  daysLeft: number | null;
  overdue: boolean;
  href: string;
};

export type JarvisMediaItem = {
  id: string;
  title: string;
  sentiment: "favorabil" | "neutru" | "defavorabil";
  canal: string;
  dateLabel: string;
  href: string;
};

export type JarvisComplianceItem = {
  id: string;
  title: string;
  status: "done" | "active" | "due-soon" | "upcoming" | "missing" | "auto";
  detail: string;
  href?: string;
};

export type JarvisCounts = {
  comunicateMonth: number;
  comunicateToday: number;
  foiaOpen: number;
  foiaOverdue: number;
  activitiesNext14: number;
  mediaToday: number;
  mediaNegative: number;
};

export type JarvisSnapshot = {
  generatedAt: string;
  dateLong: string;
  weekday: string;
  dots: JarvisStatusDot[];
  upcoming: JarvisUpcomingItem[];
  approvals: JarvisApprovalItem[];
  foia: JarvisFoiaItem[];
  media: JarvisMediaItem[];
  compliance: JarvisComplianceItem[];
  counts: JarvisCounts;
  monthLabel: string;
};

export type JarvisChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  actions?: Array<{ label: string; href: string }>;
};

export type IntakeKind =
  | "incident"
  | "activity"
  | "press"
  | "foia"
  | "event"
  | "report";
