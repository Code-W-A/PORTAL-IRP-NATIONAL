"use client";

import Link from "next/link";
import { CalendarDays, FileText, FolderOpen, Newspaper, Siren, Sparkles } from "lucide-react";

import type { JarvisSnapshot } from "./_core/types";

function gaugePct(value: number, max: number) {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((value / max) * 100));
}

export default function CommandCenter({
  snapshot,
  onAsk,
  onOpenSection,
}: {
  snapshot: JarvisSnapshot;
  onAsk: (question: string) => void;
  onOpenSection: (id: "operativ" | "calendar" | "foia" | "raportari" | "documente") => void;
}) {
  const nextEvent = snapshot.upcoming[0];
  const feed = [
    ...snapshot.approvals.map((item) => ({
      id: item.id,
      pill: item.requiresHuman ? "warn" : "info",
      pillLabel: item.requiresHuman ? "APROBĂ" : "INFO",
      title: item.title,
      detail: item.detail,
      href: item.href,
    })),
    ...snapshot.media.slice(0, 3).map((item) => ({
      id: `m-${item.id}`,
      pill: item.sentiment === "defavorabil" ? "bad" : item.sentiment === "favorabil" ? "ok" : "info",
      pillLabel: item.sentiment.toUpperCase(),
      title: item.title,
      detail: item.dateLabel,
      href: item.href,
    })),
  ].slice(0, 6);

  const modules = [
    {
      id: "operativ" as const,
      title: "Operativ",
      detail: "SMS → draft → APROBĂ",
      icon: Siren,
      href: null,
    },
    {
      id: "calendar" as const,
      title: "Calendar",
      detail: `${snapshot.counts.activitiesNext14} în 14 zile`,
      icon: CalendarDays,
      href: null,
    },
    {
      id: "foia" as const,
      title: "544",
      detail: snapshot.counts.foiaOverdue ? `${snapshot.counts.foiaOverdue} depășite` : `${snapshot.counts.foiaOpen} deschise`,
      icon: FileText,
      href: null,
    },
    {
      id: "raportari" as const,
      title: "Raportări",
      detail: `${snapshot.counts.comunicateMonth} comunicate / lună`,
      icon: Newspaper,
      href: null,
    },
    {
      id: "documente" as const,
      title: "Documente",
      detail: "Conformitate IRP",
      icon: FolderOpen,
      href: null,
    },
    {
      id: "today" as const,
      title: "BICP",
      detail: `${snapshot.counts.comunicateToday} astăzi`,
      icon: Sparkles,
      href: "/lista-BICP",
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="j-grid">
        <section className="j-glass j-core">
          <p className="jarvis-label">IRP Core</p>
          <div className="j-kpis">
            {snapshot.dots.slice(0, 5).map((dot) => (
              <div key={dot.id} className="j-kpi">
                <span>{dot.label}</span>
                <b>{dot.severity === "ok" ? "OK" : dot.severity.toUpperCase()}</b>
              </div>
            ))}
          </div>
          <div className="j-orb" aria-hidden>
            <div className="j-orb-ring" />
            <div className="j-orb-ring b" />
            <div className="j-orb-copy">
              <div>
                <strong>JARVIS IRP</strong>
                <span>CORE ONLINE</span>
              </div>
            </div>
          </div>
        </section>

        <section className="j-glass j-feed">
          <p className="jarvis-label mb-2">Live feed</p>
          {feed.length ? (
            feed.map((item) => (
              <Link key={item.id} href={item.href} className="j-feed-item">
                <span className={`j-pill ${item.pill}`}>{item.pillLabel}</span>
                <p className="mt-1 text-sm text-white">{item.title}</p>
                <p className="text-xs text-slate-400">{item.detail}</p>
              </Link>
            ))
          ) : (
            <p className="text-sm text-slate-400">Nimic urgent. Coada de aprobare e liberă.</p>
          )}
        </section>
      </div>

      <div className="j-modules">
        {modules.map((mod) => {
          const Icon = mod.icon;
          const inner = (
            <>
              <Icon size={16} className="text-teal-300" />
              <h3>{mod.title}</h3>
              <p>{mod.detail}</p>
              <div className={`j-wave ${mod.id === "operativ" ? "" : "off"}`}>
                <i /><i /><i /><i /><i />
              </div>
            </>
          );
          if (mod.href) {
            return (
              <Link key={mod.title} href={mod.href} className="j-glass j-mod">
                {inner}
              </Link>
            );
          }
          return (
            <button
              key={mod.title}
              type="button"
              className="j-glass j-mod"
              onClick={() => {
                if (mod.id !== "today") onOpenSection(mod.id);
              }}
            >
              {inner}
            </button>
          );
        })}
      </div>

      <div className="j-grid">
        <section className="j-glass j-timeline">
          <div className="mb-2 flex items-center justify-between">
            <p className="jarvis-label">Timeline</p>
            <button type="button" className="text-[11px] uppercase tracking-widest text-teal-300" onClick={() => onOpenSection("calendar")}>
              Tot calendarul
            </button>
          </div>
          {snapshot.upcoming.length ? (
            snapshot.upcoming.slice(0, 5).map((item) => (
              <Link key={item.id} href={item.href} className="j-tl">
                <span className="j-tl-date">{item.dateLabel}</span>
                <span className="j-tl-title">{item.title}</span>
                <span className="j-bar">
                  <i style={{ width: `${Math.max(12, 100 - item.daysAhead * 8)}%` }} />
                </span>
              </Link>
            ))
          ) : (
            <p className="text-sm text-slate-400">Nicio activitate în următoarele 45 de zile.</p>
          )}
          {nextEvent && (
            <button
              type="button"
              className="j-iconbtn primary mt-3 w-full"
              onClick={() => onAsk(`Pregătește-mi tot pentru ${nextEvent.title}`)}
            >
              Pregătește {nextEvent.title}
            </button>
          )}
        </section>

        <section className="j-gauges">
          <div className="j-glass j-gauge">
            <div className="j-ring" style={{ ["--p" as string]: gaugePct(snapshot.counts.comunicateMonth, 40) }}>
              <span>{snapshot.counts.comunicateMonth}</span>
            </div>
            <p className="jarvis-label">Comunicate</p>
          </div>
          <div className="j-glass j-gauge">
            <div className="j-ring" style={{ ["--p" as string]: gaugePct(snapshot.counts.foiaOpen, 10) }}>
              <span>{snapshot.counts.foiaOpen}</span>
            </div>
            <p className="jarvis-label">544 deschise</p>
          </div>
          <div className="j-glass j-gauge">
            <div className="j-ring" style={{ ["--p" as string]: gaugePct(snapshot.counts.activitiesNext14, 14) }}>
              <span>{snapshot.counts.activitiesNext14}</span>
            </div>
            <p className="jarvis-label">Activități</p>
          </div>
        </section>
      </div>
    </div>
  );
}
