"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import luxon3Plugin from "@fullcalendar/luxon3";
import roLocale from "@fullcalendar/core/locales/ro";
import type {
  DateSelectArg,
  DatesSetArg,
  EventApi,
  EventClickArg,
  EventDropArg,
} from "@fullcalendar/core";
import type {
  DateClickArg,
  EventResizeDoneArg,
} from "@fullcalendar/interaction";

import { Button } from "@/components/ui/button";
import type {
  ActivityEvent,
  ActivityEventDraft,
  ActivityFilters,
  CalendarDateRange,
  CalendarView,
} from "@/app/(admin-irp)/calendar-activitati/types";
import { useActivityEvents } from "@/app/(admin-irp)/calendar-activitati/hooks/useActivityEvents";
import { expandEventsForRange } from "@/app/(admin-irp)/calendar-activitati/utils/recurrence";
import { mapOccurrencesToCalendarEvents } from "@/app/(admin-irp)/calendar-activitati/utils/eventAdapter";
import {
  BUCHAREST_TIMEZONE,
  buildSelectionSeed,
  deriveActivityStatus,
} from "@/app/(admin-irp)/calendar-activitati/utils/datetime";
import CalendarToolbar from "@/app/(admin-irp)/calendar-activitati/components/CalendarToolbar";
import ActivityModal, {
  type ActivityModalSeed,
} from "@/app/(admin-irp)/calendar-activitati/components/ActivityModal";
import ImportIcsDialog from "@/app/(admin-irp)/calendar-activitati/components/ImportIcsDialog";

type ToastState = {
  type: "success" | "info" | "error";
  message: string;
} | null;
type ToastType = "success" | "info" | "error";

const DEFAULT_FILTERS: ActivityFilters = {
  search: "",
  category: "",
  location: "",
  status: "all",
};

const DEFAULT_RANGE: CalendarDateRange = {
  start: new Date(),
  end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
};

export default function CalendarActivitatiClient() {
  const calendarRef = useRef<FullCalendar | null>(null);

  const { events, loading, saving, error, createEvent, updateEvent, deleteEvent, reload } =
    useActivityEvents();

  const [currentView, setCurrentView] = useState<CalendarView>("dayGridMonth");
  const [currentTitle, setCurrentTitle] = useState("Calendar activități");
  const [activeRange, setActiveRange] = useState<CalendarDateRange>(DEFAULT_RANGE);

  const [filters, setFilters] = useState<ActivityFilters>(DEFAULT_FILTERS);

  const [toast, setToast] = useState<ToastState>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingEvent, setEditingEvent] = useState<ActivityEvent | null>(null);
  const [modalSeed, setModalSeed] = useState<ActivityModalSeed | null>(null);

  const [importOpen, setImportOpen] = useState(false);

  function showToast(message: string, type: ToastType = "info") {
    setToast({ message, type });
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => setToast(null), 3200);
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(events.map((item) => item.category).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, "ro")),
    [events]
  );

  const locations = useMemo(
    () => Array.from(new Set(events.map((item) => item.location).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, "ro")),
    [events]
  );

  const occurrences = useMemo(() => expandEventsForRange(events, activeRange), [events, activeRange]);

  const filteredOccurrences = useMemo(() => {
    const query = filters.search.trim().toLowerCase();

    return occurrences.filter((occurrence) => {
      if (query) {
        const haystack = `${occurrence.title} ${occurrence.description || ""}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      if (filters.category && occurrence.category !== filters.category) return false;
      if (filters.location && occurrence.location !== filters.location) return false;

      if (filters.status !== "all") {
        const status = deriveActivityStatus(
          occurrence.startDateTime,
          occurrence.endDateTime
        );
        if (status !== filters.status) return false;
      }

      return true;
    });
  }, [occurrences, filters]);

  const calendarEvents = useMemo(
    () => mapOccurrencesToCalendarEvents(filteredOccurrences),
    [filteredOccurrences]
  );

  function openCreateModalFromSeed(seed: ActivityModalSeed) {
    setModalMode("create");
    setEditingEvent(null);
    setModalSeed(seed);
    setModalOpen(true);
  }

  function openCreateModalFromRange(start: Date, end: Date, allDay: boolean) {
    openCreateModalFromSeed(buildSelectionSeed(start, end, allDay));
  }

  function openCreateModalNow() {
    const start = new Date();
    const end = new Date(Date.now() + 60 * 60 * 1000);
    openCreateModalFromRange(start, end, false);
  }

  function openEditModal(masterEventId: string) {
    const matchedEvent = events.find((item) => item.id === masterEventId);
    if (!matchedEvent) {
      showToast("Nu am găsit activitatea selectată.", "error");
      return;
    }

    setModalMode("edit");
    setEditingEvent(matchedEvent);
    setModalSeed(null);
    setModalOpen(true);
  }

  function onDatesSet(info: DatesSetArg) {
    setCurrentView(info.view.type as CalendarView);
    setCurrentTitle(info.view.title);
    setActiveRange({
      start: info.start,
      end: info.end,
    });
  }

  function onSelect(info: DateSelectArg) {
    openCreateModalFromRange(info.start, info.end, info.allDay);
  }

  function onDateClick(info: DateClickArg) {
    if (info.allDay) {
      openCreateModalFromRange(info.date, new Date(info.date.getTime() + 24 * 60 * 60 * 1000), true);
      return;
    }

    openCreateModalFromRange(info.date, new Date(info.date.getTime() + 60 * 60 * 1000), false);
  }

  function onEventClick(info: EventClickArg) {
    const masterEventId = String((info.event.extendedProps as { masterEventId?: string })?.masterEventId || "");
    if (!masterEventId) return;
    openEditModal(masterEventId);
  }

  async function persistDragResize(eventApi: EventApi, revert: () => void) {
    const eventMeta = eventApi.extendedProps as {
      masterEventId?: string;
      isRecurring?: boolean;
    };

    if (!eventMeta.masterEventId) {
      revert();
      return;
    }

    if (eventMeta.isRecurring) {
      showToast("Pentru activități recurente, modifică seria din formular.", "info");
      revert();
      return;
    }

    if (!eventApi.start) {
      revert();
      return;
    }

    const nextStart = eventApi.start.toISOString();
    const nextEnd = eventApi.end
      ? eventApi.end.toISOString()
      : new Date(eventApi.start.getTime() + (eventApi.allDay ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000)).toISOString();

    try {
      await updateEvent(eventMeta.masterEventId, {
        startDateTime: nextStart,
        endDateTime: nextEnd,
        allDay: eventApi.allDay,
      });
      showToast("Activitatea a fost actualizată.", "success");
    } catch {
      showToast("Nu am putut actualiza activitatea.", "error");
      revert();
    }
  }

  async function onEventDrop(info: EventDropArg) {
    await persistDragResize(info.event, info.revert);
  }

  async function onEventResize(info: EventResizeDoneArg) {
    await persistDragResize(info.event, info.revert);
  }

  async function handleModalSave(draft: ActivityEventDraft) {
    try {
      if (modalMode === "create") {
        await createEvent(draft);
        showToast("Activitatea a fost creată.", "success");
      } else if (editingEvent) {
        await updateEvent(editingEvent.id, draft);
        showToast("Activitatea a fost actualizată.", "success");
      }

      setModalOpen(false);
      setEditingEvent(null);
      setModalSeed(null);
    } catch {
      showToast("Nu am putut salva activitatea.", "error");
    }
  }

  async function handleModalDelete() {
    if (!editingEvent) return;

    try {
      await deleteEvent(editingEvent.id);
      setModalOpen(false);
      setEditingEvent(null);
      showToast("Activitatea a fost ștearsă.", "success");
    } catch {
      showToast("Nu am putut șterge activitatea.", "error");
    }
  }

  function navigateCalendar(action: "today" | "prev" | "next") {
    const api = calendarRef.current?.getApi();
    if (!api) return;

    if (action === "today") api.today();
    if (action === "prev") api.prev();
    if (action === "next") api.next();
  }

  function changeView(view: CalendarView) {
    setCurrentView(view);
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.changeView(view);
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendar activități</h1>
          <p className="text-sm text-gray-600">
            Planificare, recurențe și administrare activități în timezone Europe/Bucharest.
          </p>
        </div>

        <Button variant="outline" onClick={() => void reload()} disabled={loading || saving}>
          Reîncarcă
        </Button>
      </header>

      <CalendarToolbar
        currentTitle={currentTitle}
        currentView={currentView}
        filters={filters}
        categories={categories}
        locations={locations}
        onToday={() => navigateCalendar("today")}
        onPrev={() => navigateCalendar("prev")}
        onNext={() => navigateCalendar("next")}
        onViewChange={changeView}
        onAddActivity={openCreateModalNow}
        onImportIcs={() => setImportOpen(true)}
        onFiltersChange={(patch) =>
          setFilters((prev) => ({
            ...prev,
            ...patch,
          }))
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center text-sm text-gray-500">
            Se încarcă activitățile...
          </div>
        ) : (
          <>
            <FullCalendar
              ref={calendarRef}
              plugins={[
                dayGridPlugin,
                timeGridPlugin,
                listPlugin,
                interactionPlugin,
                luxon3Plugin,
              ]}
              locale={roLocale}
              timeZone={BUCHAREST_TIMEZONE}
              initialView={currentView}
              firstDay={1}
              height="auto"
              nowIndicator
              weekends
              selectable
              editable
              eventDurationEditable
              selectMirror
              dayMaxEvents
              events={calendarEvents}
              headerToolbar={false}
              select={onSelect}
              dateClick={onDateClick}
              eventClick={onEventClick}
              eventDrop={onEventDrop}
              eventResize={onEventResize}
              datesSet={onDatesSet}
              slotMinTime="06:00:00"
              slotMaxTime="22:00:00"
              noEventsContent="Nu există activități pentru filtrele selectate."
            />

            {!events.length && (
              <div className="mt-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                Nu există activități salvate. Folosește butonul „Adaugă activitate”.
              </div>
            )}
          </>
        )}
      </section>

      <ActivityModal
        open={modalOpen}
        mode={modalMode}
        initialEvent={editingEvent}
        seed={modalSeed}
        submitting={saving}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            setEditingEvent(null);
            setModalSeed(null);
          }
        }}
        onSave={handleModalSave}
        onDelete={modalMode === "edit" ? handleModalDelete : undefined}
      />

      <ImportIcsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={reload}
      />

      {toast && (
        <div className="fixed bottom-4 right-4 z-[70] animate-in slide-in-from-right-4 fade-in duration-300">
          <div
            className={`max-w-sm rounded-xl border px-4 py-3 shadow-xl ${
              toast.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : toast.type === "error"
                  ? "border-red-200 bg-red-50 text-red-900"
                  : "border-blue-200 bg-blue-50 text-blue-900"
            }`}
          >
            <div className="text-sm font-medium">{toast.message}</div>
          </div>
        </div>
      )}
    </div>
  );
}
