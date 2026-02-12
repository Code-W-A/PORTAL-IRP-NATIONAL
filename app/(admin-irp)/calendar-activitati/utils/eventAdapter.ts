import type { EventInput } from "@fullcalendar/core";

import type { ActivityOccurrence } from "@/app/(admin-irp)/calendar-activitati/types";

type CalendarExtendedProps = {
  masterEventId: string;
  occurrenceId: string;
  isRecurring: boolean;
  category?: string;
  location?: string;
  description?: string;
};

export function mapOccurrencesToCalendarEvents(occurrences: ActivityOccurrence[]) {
  return occurrences.map((occurrence): EventInput => {
    const extendedProps: CalendarExtendedProps = {
      masterEventId: occurrence.masterEventId,
      occurrenceId: occurrence.occurrenceId,
      isRecurring: (occurrence.recurrence?.freq || "none") !== "none",
      category: occurrence.category,
      location: occurrence.location,
      description: occurrence.description,
    };

    return {
      id: occurrence.occurrenceId,
      title: occurrence.title,
      start: occurrence.startDateTime,
      end: occurrence.endDateTime,
      allDay: occurrence.allDay,
      backgroundColor: occurrence.color || undefined,
      borderColor: occurrence.color || undefined,
      extendedProps,
      editable: !extendedProps.isRecurring,
      durationEditable: !extendedProps.isRecurring,
    };
  });
}

export type { CalendarExtendedProps };
