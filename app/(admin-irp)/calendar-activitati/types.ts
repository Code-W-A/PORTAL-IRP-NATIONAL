export type RecurrenceFrequency = "none" | "daily" | "weekly" | "monthly" | "yearly";

export type ActivityRecurrence = {
  freq: RecurrenceFrequency;
  interval?: number;
  byWeekDays?: number[];
  byMonthDay?: number;
  count?: number;
  until?: string;
  rrule?: string;
  exdate?: string[];
  rdate?: string[];
  timezone?: string;
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
  /** manual | google_calendar — evenimente importate din Google nu se editează preferabil manual în portal */
  source?: "manual" | "google_calendar";
  /** UID din feed-ul ICS Google */
  externalUid?: string;
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
  originalStartDateTime: string;
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

export type GoogleCalendarSyncSettings = {
  googleIcalUrl: string;
  syncEnabled: boolean;
  syncIntervalMinutes: number;
  lastSyncAt?: string;
  lastSyncStatus?: "ok" | "error";
  lastSyncMessage?: string;
  lastSyncStats?: {
    created: number;
    updated: number;
    removed: number;
    skipped: number;
    errors: number;
  };
};
