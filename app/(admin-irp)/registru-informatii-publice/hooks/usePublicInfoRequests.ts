"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { initFirebase } from "@/lib/firebase";
import type {
  PublicInfoRequest,
  PublicInfoRequestDraft,
  PublicInfoRequestOptions,
} from "@/app/(admin-irp)/registru-informatii-publice/_core/types";
import {
  createPublicInfoRequest,
  deletePublicInfoRequest,
  duplicatePublicInfoRequest,
  listPublicInfoRequests,
  updatePublicInfoRequest,
} from "@/app/(admin-irp)/registru-informatii-publice/_core/firestore";
import { loadPublicInfoRequestOptions } from "@/app/(admin-irp)/registru-informatii-publice/_core/options";

function getUserId() {
  const { auth } = initFirebase();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Trebuie să fii autentificat.");
  return uid;
}

export function usePublicInfoRequests() {
  const firebase = useMemo(() => initFirebase(), []);
  const { db } = firebase;

  const [requests, setRequests] = useState<PublicInfoRequest[]>([]);
  const [options, setOptions] = useState<PublicInfoRequestOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextRequests, nextOptions] = await Promise.all([
        listPublicInfoRequests(db),
        loadPublicInfoRequestOptions(db),
      ]);
      setRequests(nextRequests);
      setOptions(nextOptions);
    } catch (err) {
      console.error(err);
      setError("Nu am putut încărca registrul.");
    } finally {
      setLoading(false);
    }
  }, [db]);

  const createRequest = useCallback(
    async (draft: PublicInfoRequestDraft) => {
      setSaving(true);
      setError(null);
      try {
        const created = await createPublicInfoRequest(db, draft, getUserId());
        setRequests((prev) =>
          [created, ...prev].sort((a, b) => b.requestDate.localeCompare(a.requestDate))
        );
        return created;
      } catch (err) {
        console.error(err);
        setError("Nu am putut salva solicitarea.");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [db]
  );

  const updateRequest = useCallback(
    async (id: string, patch: Partial<PublicInfoRequestDraft>) => {
      setSaving(true);
      setError(null);
      try {
        const updated = await updatePublicInfoRequest(db, id, patch, getUserId());
        setRequests((prev) =>
          prev
            .map((item) => (item.id === id ? updated : item))
            .sort((a, b) => b.requestDate.localeCompare(a.requestDate))
        );
        return updated;
      } catch (err) {
        console.error(err);
        setError("Nu am putut actualiza solicitarea.");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [db]
  );

  const deleteRequest = useCallback(
    async (id: string) => {
      setSaving(true);
      setError(null);
      try {
        await deletePublicInfoRequest(db, id);
        setRequests((prev) => prev.filter((item) => item.id !== id));
      } catch (err) {
        console.error(err);
        setError("Nu am putut șterge solicitarea.");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [db]
  );

  const duplicateRequest = useCallback(
    async (id: string) => {
      setSaving(true);
      setError(null);
      try {
        const created = await duplicatePublicInfoRequest(db, id, getUserId());
        setRequests((prev) =>
          [created, ...prev].sort((a, b) => b.requestDate.localeCompare(a.requestDate))
        );
        return created;
      } catch (err) {
        console.error(err);
        setError("Nu am putut duplica solicitarea.");
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
    requests,
    options,
    loading,
    saving,
    error,
    reload,
    createRequest,
    updateRequest,
    deleteRequest,
    duplicateRequest,
  };
}
