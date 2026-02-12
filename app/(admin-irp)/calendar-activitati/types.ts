export type RecurrenceFrequency = "none" | "daily" | "weekly" | "monthly" | "yearly";

export type ActivityRecurrence = {
  freq: RecurrenceFrequency;
  interval?: number;
  byWeekDays?: number[];
  byMonthDay?: number;
  count?: number;
  until?: string;
};

export type ActivityEvent = {
  id: string;
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  allDay?: boolean;
  location?: string;
  category?: string;
  color?: string;
  recurrence?: ActivityRecurrence;
  createdAt: string;
  updatedAt: string;
  userId: string;
  workspaceId: string;
};

export type ActivityEventDraft = Omit<
  ActivityEvent,
  "id" | "createdAt" | "updatedAt" | "userId" | "workspaceId"
>;

export type ActivityOccurrence = {
  occurrenceId: string;
  masterEventId: string;
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  allDay: boolean;
  location?: string;
  category?: string;
  color?: string;
  recurrence?: ActivityRecurrence;
};

export type CalendarView = "dayGridMonth" | "timeGridWeek" | "timeGridDay" | "listWeek";

export type ActivityStatus = "upcoming" | "ongoing" | "past";

export type ActivityFilters = {
  search: string;
  category: string;
  location: string;
  status: "all" | ActivityStatus;
};

export type CalendarDateRange = {
  start: Date;
  end: Date;
};
