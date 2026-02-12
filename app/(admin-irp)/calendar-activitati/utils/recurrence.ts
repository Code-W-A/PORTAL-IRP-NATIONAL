import { DateTime } from "luxon";

import type { ActivityEvent, ActivityOccurrence, CalendarDateRange, RecurrenceFrequency } from "@/app/(admin-irp)/calendar-activitati/types";
import { BUCHAREST_TIMEZONE } from "@/app/(admin-irp)/calendar-activitati/utils/datetime";

const MAX_ITERATIONS_PER_EVENT = 50000;

function normalizeFrequency(freq: unknown): RecurrenceFrequency {
  if (freq === "daily" || freq === "weekly" || freq === "monthly" || freq === "yearly") {
    return freq;
  }
  return "none";
}

function normalizeWeekDays(days: unknown, fallback: number) {
  if (!Array.isArray(days)) return [fallback];
  const normalized = Array.from(
    new Set(
      days
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6)
    )
  ).sort((left, right) => left - right);
  return normalized.length ? normalized : [fallback];
}

function overlaps(occurrenceStart: DateTime, occurrenceEnd: DateTime, rangeStart: DateTime, rangeEnd: DateTime) {
  return occurrenceStart < rangeEnd && occurrenceEnd > rangeStart;
}

function toOccurrence(
  masterEvent: ActivityEvent,
  occurrenceStart: DateTime,
  occurrenceEnd: DateTime
): ActivityOccurrence {
  const startIso = occurrenceStart.toUTC().toISO({ suppressMilliseconds: true }) || occurrenceStart.toUTC().toISO() || new Date().toISOString();
  const endIso = occurrenceEnd.toUTC().toISO({ suppressMilliseconds: true }) || occurrenceEnd.toUTC().toISO() || new Date().toISOString();

  return {
    occurrenceId: `${masterEvent.id}__${occurrenceStart.toUTC().toMillis()}`,
    masterEventId: masterEvent.id,
    title: masterEvent.title,
    description: masterEvent.description,
    startDateTime: startIso,
    endDateTime: endIso,
    allDay: masterEvent.allDay === true,
    location: masterEvent.location,
    category: masterEvent.category,
    color: masterEvent.color,
    recurrence: masterEvent.recurrence,
  };
}

function buildOccurrenceBounds(
  candidateStart: DateTime,
  allDay: boolean,
  durationMs: number,
  durationDays: number
) {
  const occurrenceStart = allDay ? candidateStart.startOf("day") : candidateStart;
  const occurrenceEnd = allDay
    ? occurrenceStart.plus({ days: durationDays })
    : occurrenceStart.plus({ milliseconds: durationMs });

  return { occurrenceStart, occurrenceEnd };
}

function appendIfVisible(
  output: ActivityOccurrence[],
  masterEvent: ActivityEvent,
  rangeStart: DateTime,
  rangeEnd: DateTime,
  candidateStart: DateTime,
  allDay: boolean,
  durationMs: number,
  durationDays: number
) {
  const { occurrenceStart, occurrenceEnd } = buildOccurrenceBounds(
    candidateStart,
    allDay,
    durationMs,
    durationDays
  );

  if (overlaps(occurrenceStart, occurrenceEnd, rangeStart, rangeEnd)) {
    output.push(toOccurrence(masterEvent, occurrenceStart, occurrenceEnd));
  }
}

export function expandEventsForRange(
  masterEvents: ActivityEvent[],
  range: CalendarDateRange,
  timezone = BUCHAREST_TIMEZONE
) {
  const rangeStart = DateTime.fromJSDate(range.start, { zone: timezone });
  const rangeEnd = DateTime.fromJSDate(range.end, { zone: timezone });

  if (!rangeStart.isValid || !rangeEnd.isValid || rangeEnd <= rangeStart) {
    return [] as ActivityOccurrence[];
  }

  const occurrences: ActivityOccurrence[] = [];

  for (const masterEvent of masterEvents) {
    const recurrence = masterEvent.recurrence;
    const frequency = normalizeFrequency(recurrence?.freq);

    const start = DateTime.fromISO(masterEvent.startDateTime, { setZone: true }).setZone(timezone);
    let end = DateTime.fromISO(masterEvent.endDateTime, { setZone: true }).setZone(timezone);

    if (!start.isValid) continue;
    if (!end.isValid || end <= start) {
      end = masterEvent.allDay ? start.plus({ days: 1 }) : start.plus({ hours: 1 });
    }

    const allDay = masterEvent.allDay === true;
    const interval = Math.max(1, Number(recurrence?.interval || 1));

    const countLimit =
      Number.isFinite(recurrence?.count) && Number(recurrence?.count) > 0
        ? Number(recurrence?.count)
        : null;

    const until = recurrence?.until
      ? DateTime.fromISO(recurrence.until, { setZone: true }).setZone(timezone)
      : null;

    const durationDays = allDay
      ? Math.max(Math.round(end.startOf("day").diff(start.startOf("day"), "days").days), 1)
      : 0;

    const durationMs = allDay
      ? 0
      : Math.max(end.toMillis() - start.toMillis(), 60 * 1000);

    if (frequency === "none") {
      appendIfVisible(
        occurrences,
        masterEvent,
        rangeStart,
        rangeEnd,
        allDay ? start.startOf("day") : start,
        allDay,
        durationMs,
        durationDays
      );
      continue;
    }

    let emitted = 0;

    const shouldStopByLimit = (candidateStart: DateTime) => {
      if (until && candidateStart > until) return true;
      if (countLimit && emitted >= countLimit) return true;
      return false;
    };

    if (frequency === "daily") {
      for (let step = 0; step < MAX_ITERATIONS_PER_EVENT; step += 1) {
        const candidateStart = (allDay ? start.startOf("day") : start).plus({
          days: step * interval,
        });

        if (candidateStart < start) continue;
        if (shouldStopByLimit(candidateStart)) break;

        emitted += 1;

        appendIfVisible(
          occurrences,
          masterEvent,
          rangeStart,
          rangeEnd,
          candidateStart,
          allDay,
          durationMs,
          durationDays
        );

        if (!until && !countLimit && candidateStart >= rangeEnd) break;
      }
      continue;
    }

    if (frequency === "weekly") {
      const fallbackWeekday = start.weekday % 7;
      const byWeekDays = normalizeWeekDays(recurrence?.byWeekDays, fallbackWeekday);
      const weekStartOffset = start.weekday % 7;
      const firstWeekStart = (allDay ? start.startOf("day") : start).minus({
        days: weekStartOffset,
      });

      let stop = false;
      for (let weekIndex = 0; weekIndex < MAX_ITERATIONS_PER_EVENT && !stop; weekIndex += 1) {
        const currentWeekStart = firstWeekStart.plus({ weeks: weekIndex * interval });

        if (!until && !countLimit && currentWeekStart > rangeEnd) break;

        for (const day of byWeekDays) {
          const dayCandidate = currentWeekStart.plus({ days: day });
          const candidateStart = allDay
            ? dayCandidate.startOf("day")
            : dayCandidate.set({
                hour: start.hour,
                minute: start.minute,
                second: start.second,
                millisecond: start.millisecond,
              });

          if (candidateStart < start) continue;
          if (shouldStopByLimit(candidateStart)) {
            stop = true;
            break;
          }

          emitted += 1;

          appendIfVisible(
            occurrences,
            masterEvent,
            rangeStart,
            rangeEnd,
            candidateStart,
            allDay,
            durationMs,
            durationDays
          );

          if (!until && !countLimit && candidateStart >= rangeEnd) {
            stop = true;
            break;
          }
        }
      }
      continue;
    }

    if (frequency === "monthly") {
      const monthDay = Math.max(1, Math.min(31, Number(recurrence?.byMonthDay || start.day)));
      const monthAnchor = (allDay ? start.startOf("day") : start).startOf("month");

      for (let monthOffset = 0; monthOffset < MAX_ITERATIONS_PER_EVENT; monthOffset += 1) {
        const currentMonth = monthAnchor.plus({ months: monthOffset * interval });

        if (!until && !countLimit && currentMonth > rangeEnd.endOf("month")) break;

        if (monthDay > currentMonth.daysInMonth) continue;

        const dayCandidate = currentMonth.set({ day: monthDay });
        const candidateStart = allDay
          ? dayCandidate.startOf("day")
          : dayCandidate.set({
              hour: start.hour,
              minute: start.minute,
              second: start.second,
              millisecond: start.millisecond,
            });

        if (candidateStart < start) continue;
        if (shouldStopByLimit(candidateStart)) break;

        emitted += 1;

        appendIfVisible(
          occurrences,
          masterEvent,
          rangeStart,
          rangeEnd,
          candidateStart,
          allDay,
          durationMs,
          durationDays
        );

        if (!until && !countLimit && candidateStart >= rangeEnd) break;
      }
      continue;
    }

    const monthDay = Math.max(1, Math.min(31, Number(recurrence?.byMonthDay || start.day)));
    const targetMonth = start.month;

    for (let yearOffset = 0; yearOffset < MAX_ITERATIONS_PER_EVENT; yearOffset += 1) {
      const year = start.year + yearOffset * interval;
      const yearMonth = DateTime.fromObject({ year, month: targetMonth, day: 1 }, { zone: timezone });

      if (!yearMonth.isValid) continue;
      if (!until && !countLimit && yearMonth > rangeEnd.endOf("year")) break;

      if (monthDay > yearMonth.daysInMonth) {
        continue;
      }

      const dayCandidate = DateTime.fromObject(
        {
          year,
          month: targetMonth,
          day: monthDay,
          hour: allDay ? 0 : start.hour,
          minute: allDay ? 0 : start.minute,
          second: allDay ? 0 : start.second,
          millisecond: allDay ? 0 : start.millisecond,
        },
        { zone: timezone }
      );

      if (!dayCandidate.isValid || dayCandidate < start) continue;
      if (shouldStopByLimit(dayCandidate)) break;

      emitted += 1;

      appendIfVisible(
        occurrences,
        masterEvent,
        rangeStart,
        rangeEnd,
        allDay ? dayCandidate.startOf("day") : dayCandidate,
        allDay,
        durationMs,
        durationDays
      );

      if (!until && !countLimit && dayCandidate >= rangeEnd) break;
    }
  }

  return occurrences.sort((left, right) => {
    if (left.startDateTime === right.startDateTime) {
      return left.title.localeCompare(right.title, "ro");
    }
    return left.startDateTime.localeCompare(right.startDateTime);
  });
}
