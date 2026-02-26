import type { EventInput } from "@fullcalendar/core";

import type { ActivityOccurrence } from "@/app/(admin-irp)/calendar-activitati/types";

type CalendarExtendedProps = {
  masterEventId: string;
  occurrenceId: string;
  originalStartDateTime: string;
  isRecurring: boolean;
  category?: string;
  location?: string;
  description?: string;
};

export function mapOccurrencesToCalendarEvents(occurrences: ActivityOccurrence[]) {
  return occurrences.map((occurrence): EventInput => {
    const recurrence = occurrence.recurrence;
    const isRecurring = Boolean(
      recurrence
        && ((recurrence.freq || "none") !== "none" || (recurrence.rrule && recurrence.rrule.trim()))
    );

    const extendedProps: CalendarExtendedProps = {
      masterEventId: occurrence.masterEventId,
      occurrenceId: occurrence.occurrenceId,
      originalStartDateTime: occurrence.originalStartDateTime,
      isRecurring,
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
      editable: true,
      durationEditable: true,
    };
  });
}

export type { CalendarExtendedProps };
