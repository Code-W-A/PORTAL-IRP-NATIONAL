"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { initFirebase } from "@/lib/firebase";
import type { ActivityEvent, ActivityEventDraft } from "@/app/(admin-irp)/calendar-activitati/types";
import {
  createActivityEvent,
  deleteActivityEvent,
  listActivityEvents,
  updateActivityEvent,
} from "@/app/(admin-irp)/calendar-activitati/services/activityEvents.service";

type UseActivityEventsResult = {
  events: ActivityEvent[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  reload: () => Promise<void>;
  createEvent: (draft: ActivityEventDraft) => Promise<ActivityEvent>;
  updateEvent: (eventId: string, patch: Partial<ActivityEventDraft>) => Promise<ActivityEvent>;
  deleteEvent: (eventId: string) => Promise<void>;
};

function getUserId() {
  const { auth } = initFirebase();
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error("Trebuie să fii autentificat pentru această acțiune.");
  }
  return uid;
}

export function useActivityEvents(): UseActivityEventsResult {
  const firebase = useMemo(() => initFirebase(), []);
  const { db } = firebase;

  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextEvents = await listActivityEvents(db);
      setEvents(nextEvents);
    } catch (err) {
      console.error(err);
      setError("Nu am putut încărca activitățile.");
    } finally {
      setLoading(false);
    }
  }, [db]);

  const createEvent = useCallback(
    async (draft: ActivityEventDraft) => {
      setSaving(true);
      setError(null);
      try {
        const userId = getUserId();
        const created = await createActivityEvent(db, draft, userId);
        setEvents((prev) => [...prev, created].sort((a, b) => a.startDateTime.localeCompare(b.startDateTime)));
        return created;
      } catch (err) {
        console.error(err);
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Nu am putut salva activitatea.";
        setError(message);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [db]
  );

  const updateEvent = useCallback(
    async (eventId: string, patch: Partial<ActivityEventDraft>) => {
      setSaving(true);
      setError(null);
      try {
        const userId = getUserId();
        const updated = await updateActivityEvent(db, eventId, patch, userId);
        setEvents((prev) =>
          prev
            .map((eventItem) => (eventItem.id === eventId ? updated : eventItem))
            .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime))
        );
        return updated;
      } catch (err) {
        console.error(err);
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Nu am putut actualiza activitatea.";
        setError(message);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [db]
  );

  const deleteEvent = useCallback(
    async (eventId: string) => {
      setSaving(true);
      setError(null);
      try {
        await deleteActivityEvent(db, eventId);
        setEvents((prev) => prev.filter((eventItem) => eventItem.id !== eventId));
      } catch (err) {
        console.error(err);
        const message =
          err instanceof Error && err.message
            ? err.message
            : "Nu am putut șterge activitatea.";
        setError(message);
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [db]
  );

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    events,
    loading,
    saving,
    error,
    reload,
    createEvent,
    updateEvent,
    deleteEvent,
  };
}
