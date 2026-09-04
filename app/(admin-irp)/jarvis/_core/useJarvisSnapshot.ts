"use client";

import { useCallback, useEffect, useState } from "react";
import { collection, doc, getDocs } from "firebase/firestore";

import { listActivityEvents } from "@/app/(admin-irp)/calendar-activitati/services/activityEvents.service";
import { expandEventsForRange } from "@/app/(admin-irp)/calendar-activitati/utils/recurrence";
import { listPublicInfoRequests } from "@/app/(admin-irp)/registru-informatii-publice/_core/firestore";
import { initFirebase } from "@/lib/firebase";
import { getTenantContext } from "@/lib/tenant";

import { buildCompliance } from "./compliance";
import {
  addDays,
  daysBetween,
  formatDayMonthRo,
  formatLongRo,
  formatMonthYearRo,
  formatShortDateRo,
  parseBicpDate,
  startOfDay,
} from "./format";
import type {
  JarvisApprovalItem,
  JarvisFoiaItem,
  JarvisMediaItem,
  JarvisSnapshot,
  JarvisStatusDot,
  JarvisUpcomingItem,
} from "./types";

const DEFAULT_FOIA_TERM_DAYS = 10;

type ComunicatFirestoreDoc = {
  id: string;
  dataTimestamp?: { toDate?: () => Date };
  data?: unknown;
};

type MonitorizarePresaFirestoreDoc = {
  id: string;
  sentiment?: unknown;
  titlu?: unknown;
  canal?: unknown;
  data?: unknown;
};

function parseMediaSentiment(raw: unknown): JarvisMediaItem["sentiment"] {
  const value = String(raw || "neutru");
  if (value === "favorabil" || value === "defavorabil") return value;
  return "neutru";
}

function isOpenFoia(nature: string) {
  const value = nature.toLowerCase();
  return !value || value.includes("lucru") || value.includes("nesolu") || value === "nespecificat";
}

export function useJarvisSnapshot() {
  const [snapshot, setSnapshot] = useState<JarvisSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { db } = initFirebase();
      const { judetId, structuraId } = getTenantContext();
      const tenantRef = doc(db, `Judete/${judetId}/Structuri/${structuraId}`);
      const now = new Date();
      const today = startOfDay(now);
      const rangeEnd = addDays(today, 45);

      const [events, requests, comunicateSnap, mediaSnap] = await Promise.all([
        listActivityEvents(db),
        listPublicInfoRequests(db).catch(() => []),
        getDocs(collection(tenantRef, "Comunicate")).catch(() => null),
        getDocs(collection(tenantRef, "MonitorizarePresa")).catch(() => null),
      ]);

      const occurrences = expandEventsForRange(events, { start: today, end: rangeEnd })
        .slice()
        .sort((a, b) => a.startDateTime.localeCompare(b.startDateTime));

      const upcoming: JarvisUpcomingItem[] = occurrences.slice(0, 8).map((item) => {
        const start = new Date(item.startDateTime);
        return {
          id: item.occurrenceId,
          dateLabel: formatDayMonthRo(start),
          title: item.title,
          source: "calendar",
          href: "/calendar-activitati",
          daysAhead: daysBetween(today, start),
          location: item.location,
        };
      });

      const foia: JarvisFoiaItem[] = requests.map((item) => {
        const received = new Date(item.requestDate);
        const termDays = item.termDays && item.termDays > 0 ? item.termDays : DEFAULT_FOIA_TERM_DAYS;
        const deadline = addDays(received, termDays);
        const hasResponse = Boolean(item.responseDate);
        const open = !hasResponse && isOpenFoia(item.responseNature);
        const daysLeft = open ? daysBetween(today, deadline) : null;
        return {
          id: item.id,
          requestNumber: item.requestNumber || "—",
          requesterName: item.requesterName || "Solicitant nenumit",
          receivedAtLabel: formatShortDateRo(received),
          status: hasResponse ? item.responseNature || "soluționat" : item.responseNature || "în lucru",
          deadlineLabel: formatShortDateRo(deadline),
          daysLeft,
          overdue: open && daysLeft !== null && daysLeft < 0,
          href: "/registru-informatii-publice",
        };
      });

      const openFoia = foia.filter((item) => item.daysLeft !== null);
      const overdueFoia = openFoia.filter((item) => item.overdue);
      const dueSoonFoia = openFoia.filter((item) => !item.overdue && (item.daysLeft ?? 99) <= 5);

      const comunicate: ComunicatFirestoreDoc[] = comunicateSnap
        ? comunicateSnap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ComunicatFirestoreDoc, "id">),
          }))
        : [];
      const comunicateThisMonth = comunicate.filter((item) => {
        const date = parseBicpDate(item);
        return date && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      });
      const comunicateToday = comunicateThisMonth.filter((item) => {
        const date = parseBicpDate(item);
        return date && startOfDay(date).getTime() === today.getTime();
      });

      const mediaRaw: MonitorizarePresaFirestoreDoc[] = mediaSnap
        ? mediaSnap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<MonitorizarePresaFirestoreDoc, "id">),
          }))
        : [];
      const media: JarvisMediaItem[] = mediaRaw
        .map((item) => ({
          id: String(item.id),
          title: String(item.titlu || "Material fără titlu"),
          sentiment: parseMediaSentiment(item.sentiment),
          canal: String(item.canal || "presa"),
          dateLabel: typeof item.data === "string" ? item.data : formatShortDateRo(now),
          href: "/monitorizare/lista",
        }))
        .slice(0, 8);

      const mediaToday = mediaRaw.filter((item) => {
        const raw = String(item.data || "");
        const parsed = Date.parse(raw);
        if (Number.isFinite(parsed)) return startOfDay(new Date(parsed)).getTime() === today.getTime();
        const slash = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (!slash) return false;
        const date = new Date(Number(slash[3]), Number(slash[2]) - 1, Number(slash[1]));
        return startOfDay(date).getTime() === today.getTime();
      });
      const mediaNegative = mediaRaw.filter((item) => String(item.sentiment) === "defavorabil");

      const activitiesNext14 = upcoming.filter((item) => item.daysAhead <= 14).length;
      const docsDueSoon = dueSoonFoia.length + (mediaToday.length ? 0 : 1);

      const dots: JarvisStatusDot[] = [
        {
          id: "operativ",
          severity: "info",
          label: "Intervențiile SMS trăiesc în Expo — urmează același depozit Firestore",
          href: "/creaza-BICP",
        },
        {
          id: "docs",
          severity: docsDueSoon > 0 ? "warn" : "ok",
          label:
            docsDueSoon > 0
              ? `${docsDueSoon} ${docsDueSoon === 1 ? "document IRP cu termen apropiat" : "documente IRP cu termen apropiat"}`
              : "Niciun document IRP cu termen imediat",
          href: "/jarvis?tab=documente",
        },
        {
          id: "foia",
          severity: overdueFoia.length ? "critical" : openFoia.length ? "watch" : "ok",
          label: overdueFoia.length
            ? `${overdueFoia.length} solicitări 544 depășite`
            : openFoia.length
              ? `${openFoia.length} ${openFoia.length === 1 ? "solicitare 544 în lucru" : "solicitări 544 în lucru"}`
              : "Nicio solicitare 544 în lucru",
          href: "/registru-informatii-publice",
        },
        {
          id: "comm",
          severity: activitiesNext14 ? "info" : "ok",
          label: activitiesNext14
            ? `${activitiesNext14} ${activitiesNext14 === 1 ? "activitate de comunicare programată" : "activități de comunicare programate"}`
            : "Nicio activitate de comunicare în următoarele 14 zile",
          href: "/calendar-activitati",
        },
        {
          id: "media",
          severity: mediaNegative.length ? "critical" : mediaToday.length ? "ok" : "watch",
          label: mediaNegative.length
            ? `${mediaNegative.length} apariții negative de verificat`
            : mediaToday.length
              ? "monitorizarea media efectuată"
              : "monitorizarea media nu este încă înregistrată astăzi",
          href: "/monitorizare/lista",
        },
      ];

      const approvals: JarvisApprovalItem[] = [];
      for (const item of dueSoonFoia.slice(0, 3)) {
        approvals.push({
          id: `foia-${item.id}`,
          kind: "foia",
          title: `544 / ${item.requestNumber}`,
          detail: `${item.requesterName} — termen ${item.deadlineLabel}`,
          href: "/registru-informatii-publice",
          requiresHuman: true,
        });
      }
      for (const item of upcoming.filter((entry) => entry.daysAhead <= 7).slice(0, 3)) {
        approvals.push({
          id: `act-${item.id}`,
          kind: "activity",
          title: item.title,
          detail:
            item.daysAhead === 0
              ? "Astăzi — material de aprobat / publicat"
              : `Peste ${item.daysAhead} zile — draft, Canva, checklist`,
          href: "/calendar-activitati",
          requiresHuman: item.daysAhead <= 2,
        });
      }
      for (const item of media.filter((entry) => entry.sentiment === "defavorabil").slice(0, 2)) {
        approvals.push({
          id: `media-${item.id}`,
          kind: "media",
          title: item.title,
          detail: "Apariție negativă — compară cu datele oficiale",
          href: "/monitorizare/lista",
          requiresHuman: true,
        });
      }

      const snapshotNext: JarvisSnapshot = {
        generatedAt: now.toISOString(),
        dateLong: formatLongRo(now),
        weekday: now.toLocaleDateString("ro-RO", { weekday: "long" }),
        dots,
        upcoming,
        approvals,
        foia: openFoia.sort((a, b) => (a.daysLeft ?? 99) - (b.daysLeft ?? 99)).slice(0, 8),
        media,
        compliance: buildCompliance({
          hasFoiaThisYear: requests.some((item) => new Date(item.requestDate).getFullYear() === now.getFullYear()),
          hasComunicateThisMonth: comunicateThisMonth.length > 0,
          hasMediaToday: mediaToday.length > 0,
          upcomingNamed: upcoming.map((item) => ({ title: item.title, daysAhead: item.daysAhead })),
        }),
        counts: {
          comunicateMonth: comunicateThisMonth.length,
          comunicateToday: comunicateToday.length,
          foiaOpen: openFoia.length,
          foiaOverdue: overdueFoia.length,
          activitiesNext14,
          mediaToday: mediaToday.length,
          mediaNegative: mediaNegative.length,
        },
        monthLabel: formatMonthYearRo(now),
      };

      setSnapshot(snapshotNext);
    } catch (err) {
      console.error(err);
      setError("Nu am putut încărca starea IRP.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { snapshot, loading, error, reload };
}
