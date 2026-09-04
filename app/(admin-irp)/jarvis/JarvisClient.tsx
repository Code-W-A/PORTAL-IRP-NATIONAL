"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  FileText,
  FolderOpen,
  Loader2,
  Newspaper,
  Plus,
  RefreshCw,
  Send,
  Siren,
  Sparkles,
  Volume2,
  VolumeX,
} from "lucide-react";

import BootSequence from "./BootSequence";
import CommandCenter from "./CommandCenter";
import { getBootAudioState, subscribeBootAudio, toggleJarvisBootTrack } from "./_core/bootAudio";
import { answerJarvis } from "./_core/brain";
import { INTAKE_OPTIONS } from "./_core/intake";
import { useJarvisSnapshot } from "./_core/useJarvisSnapshot";
import type { JarvisChatMessage, JarvisSection } from "./_core/types";
import "./jarvis.css";
import "./command-center.css";

const SECTIONS: Array<{ id: JarvisSection; label: string; icon: typeof Sparkles }> = [
  { id: "today", label: "Command", icon: Sparkles },
  { id: "operativ", label: "Operativ", icon: Siren },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "foia", label: "544", icon: FileText },
  { id: "raportari", label: "Raportări", icon: Newspaper },
  { id: "documente", label: "Documente", icon: FolderOpen },
];

const COMPLIANCE_MARK: Record<string, string> = {
  done: "▣",
  active: "▣",
  auto: "▣",
  "due-soon": "◐",
  upcoming: "○",
  missing: "–",
};

function isSection(value: string | null): value is JarvisSection {
  return SECTIONS.some((item) => item.id === value);
}

export default function JarvisClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { snapshot, loading, error, reload } = useJarvisSnapshot();
  const tabParam = searchParams.get("tab");
  const section: JarvisSection = isSection(tabParam) ? tabParam : "today";

  const [ask, setAsk] = useState("");
  const [messages, setMessages] = useState<JarvisChatMessage[]>([]);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [booting, setBooting] = useState(true);
  const [trackPlaying, setTrackPlaying] = useState(false);
  const [clock, setClock] = useState("");
  const askRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.body.classList.add("jarvis-night");
    return () => document.body.classList.remove("jarvis-night");
  }, []);

  useEffect(() => {
    const sync = () => setTrackPlaying(getBootAudioState().playing);
    sync();
    return subscribeBootAudio(sync);
  }, []);

  useEffect(() => {
    const tick = () => {
      setClock(
        new Date().toLocaleTimeString("ro-RO", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!snapshot || messages.length) return;
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        text: "Sistemele sunt online. Citesc calendarul, registrul 544, comunicatele și monitorizarea. Tu rămâi ultimul filtru.",
      },
    ]);
  }, [snapshot, messages.length]);

  const finishBoot = useCallback(() => setBooting(false), []);

  function setSection(next: JarvisSection) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "today") params.delete("tab");
    else params.set("tab", next);
    const query = params.toString();
    router.replace(query ? `/jarvis?${query}` : "/jarvis");
  }

  function submitAsk(question?: string) {
    const text = (question ?? ask).trim();
    if (!text || !snapshot) return;
    const userMessage: JarvisChatMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      text,
    };
    const reply = answerJarvis(text, snapshot);
    setMessages((prev) => [...prev, userMessage, reply]);
    setAsk("");
  }

  const suggestions = useMemo(
    () => ["Ce am azi?", "Ce 544 expiră?", "Pregătește 13 septembrie", "Ce e restant?"],
    []
  );

  const systemState =
    snapshot?.counts.foiaOverdue || snapshot?.counts.mediaNegative
      ? "bad"
      : snapshot?.approvals.some((item) => item.requiresHuman)
        ? "warn"
        : "ok";

  return (
    <div className="jarvis-root j-premium">
      {booting && <BootSequence onDone={finishBoot} />}

      <div className={`j-shell ${booting ? "is-hidden" : ""}`}>
        <header className="j-glass j-top">
          <div className="j-brand">
            <div className="j-logo">
              <Sparkles size={18} />
            </div>
            <div>
              <h1 className="jarvis-display">JARVIS IRP</h1>
              <p>Command center</p>
            </div>
          </div>

          <div className="j-clock">
            <strong className="jarvis-display">{clock || "--:--:--"}</strong>
            <span>{snapshot?.dateLong || "Sistem online"}</span>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className={`j-status ${systemState}`}>
              <i />
              {systemState === "ok" ? "Optimal" : systemState === "warn" ? "Atenție" : "Critic"}
            </span>
            <button type="button" className="j-iconbtn" onClick={() => toggleJarvisBootTrack()} aria-label="Audio">
              {trackPlaying ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>
            <button type="button" className="j-iconbtn" onClick={() => setBooting(true)}>
              Reboot
            </button>
            <button type="button" className="j-iconbtn" onClick={() => void reload()} aria-label="Sync">
              {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            </button>
            <button type="button" className="j-iconbtn primary" onClick={() => setIntakeOpen(true)}>
              <Plus size={15} /> Nou
            </button>
          </div>
        </header>

        <div className="j-body">
          <nav className="j-glass j-rail">
            {SECTIONS.map((item) => {
              const Icon = item.icon;
              const badge =
                item.id === "foia"
                  ? snapshot?.counts.foiaOpen
                  : item.id === "calendar"
                    ? snapshot?.counts.activitiesNext14
                    : item.id === "raportari"
                      ? snapshot?.counts.comunicateMonth
                      : 0;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`j-rail-btn ${section === item.id ? "active" : ""}`}
                  onClick={() => setSection(item.id)}
                >
                  <Icon size={16} />
                  {item.label}
                  {badge ? (
                    <span className={`j-badge ${item.id === "foia" && snapshot?.counts.foiaOverdue ? "hot" : ""}`}>
                      {badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          <div className="j-main">
            {error && <p className="j-glass px-4 py-3 text-sm text-rose-200">{error}</p>}
            {loading && !snapshot && (
              <p className="flex items-center gap-2 px-2 text-sm text-slate-400">
                <Loader2 size={16} className="animate-spin" /> Se citește starea IRP…
              </p>
            )}

            {messages.length > 1 && (
              <section className="j-glass j-chat">
                {messages.slice(-3).map((message) => (
                  <div key={message.id} className={`j-bubble ${message.role === "user" ? "user" : "ai"}`}>
                    {message.text}
                    {message.actions?.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {message.actions.map((action) => (
                          <Link key={action.href + action.label} href={action.href} className="j-iconbtn">
                            {action.label}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </section>
            )}

            {snapshot && section === "today" && (
              <CommandCenter snapshot={snapshot} onAsk={submitAsk} onOpenSection={setSection} />
            )}
            {snapshot && section === "operativ" && <OperativSection />}
            {snapshot && section === "calendar" && <CalendarSection snapshot={snapshot} onAsk={submitAsk} />}
            {snapshot && section === "foia" && <FoiaSection snapshot={snapshot} />}
            {snapshot && section === "raportari" && <ReportsSection snapshot={snapshot} />}
            {snapshot && section === "documente" && <DocumentsSection snapshot={snapshot} />}
          </div>
        </div>

        <footer className="j-dock">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              {suggestions.map((item) => (
                <button key={item} type="button" className="j-iconbtn" onClick={() => submitAsk(item)}>
                  {item}
                </button>
              ))}
            </div>
            <div className="j-glass j-ask">
              <Sparkles size={16} className="text-teal-300" />
              <input
                ref={askRef}
                value={ask}
                onChange={(event) => setAsk(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submitAsk();
                }}
                placeholder="Întreabă IRP — ce am azi, ce 544 expiră, pregătește 13 septembrie…"
              />
              <button type="button" className="j-iconbtn primary" onClick={() => submitAsk()} disabled={!snapshot}>
                <Send size={14} /> Execută
              </button>
            </div>
          </div>
          <p className="hidden text-[10px] uppercase tracking-[0.2em] text-slate-500 lg:block">ISU DB · lock uman</p>
        </footer>
      </div>

      {intakeOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="j-glass w-full max-w-lg p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="jarvis-label">Intake</p>
                <h2 className="jarvis-display mt-1 text-xl text-white">Informație nouă</h2>
                <p className="text-sm text-slate-400">O singură dată. Sistemul leagă restul lanțului.</p>
              </div>
              <button type="button" onClick={() => setIntakeOpen(false)} className="j-iconbtn">
                Close
              </button>
            </div>
            <div className="grid gap-2">
              {INTAKE_OPTIONS.map((option) => (
                <button
                  key={option.kind}
                  type="button"
                  onClick={() => {
                    setIntakeOpen(false);
                    router.push(option.href);
                  }}
                  className="j-glass flex items-start gap-3 px-3 py-3 text-left"
                >
                  <span className="text-xl">{option.emoji}</span>
                  <span>
                    <span className="block text-sm font-medium text-white">{option.title}</span>
                    <span className="block text-xs text-slate-400">{option.detail}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OperativSection() {
  const steps = [
    ["01", "SMS autorizat → POST /api/irp/incoming"],
    ["02", "Clasificare + lipire pe evenimentul activ"],
    ["03", "Draft comunicat / Facebook / WhatsApp / site / MAI"],
    ["04", "APROBĂ UPDATE / APROBĂ ȘI PUBLICĂ"],
    ["05", "Arhivă Drive · opis · indicatori · raport"],
  ];

  return (
    <section className="j-glass j-section">
      <h2 className="jarvis-display text-xl text-white">Operativ</h2>
      <p className="mt-1 text-sm text-slate-400">Telefonul e urechea. Next.js e creierul. SMS-ul nu publică singur.</p>
      <div className="mt-4 space-y-2">
        {steps.map(([n, text]) => (
          <div key={n} className="jarvis-step">
            <b>{n}</b>
            <span className="text-sm text-sky-50">{text}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-xl border border-amber-300/25 bg-amber-300/5 px-3 py-3 text-sm text-amber-50">
        Incidentele SMS sunt încă locale în Expo. Faza 2 le aduce aici.
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/creaza-BICP" className="j-iconbtn primary">
          Creează comunicat
        </Link>
        <Link href="/statistici-interventii" className="j-iconbtn">
          Statistici intervenții
        </Link>
      </div>
    </section>
  );
}

function CalendarSection({
  snapshot,
  onAsk,
}: {
  snapshot: NonNullable<ReturnType<typeof useJarvisSnapshot>["snapshot"]>;
  onAsk: (q: string) => void;
}) {
  return (
    <section className="j-glass j-section">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="jarvis-display text-xl text-white">Calendar / postări</h2>
          <p className="text-sm text-slate-400">Sursă oficială: Calendar IGSU → aplicație → Google Calendar.</p>
        </div>
        <Link href="/calendar-activitati" className="j-iconbtn">
          Deschide
        </Link>
      </div>
      <div className="space-y-2">
        {snapshot.upcoming.length ? (
          snapshot.upcoming.map((item) => (
            <div key={item.id} className="j-tl">
              <span className="j-tl-date">{item.dateLabel}</span>
              <span className="j-tl-title">{item.title}</span>
              <button type="button" className="j-iconbtn primary" onClick={() => onAsk(`Pregătește-mi tot pentru ${item.title}`)}>
                Pregătește
              </button>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-400">Importă foaia IGSU ca să apară aici.</p>
        )}
      </div>
    </section>
  );
}

function FoiaSection({
  snapshot,
}: {
  snapshot: NonNullable<ReturnType<typeof useJarvisSnapshot>["snapshot"]>;
}) {
  return (
    <section className="j-glass j-section">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="jarvis-display text-xl text-white">544</h2>
          <p className="text-sm text-slate-400">Termen din registru. Răspunsul final rămâne cu lock uman.</p>
        </div>
        <Link href="/registru-informatii-publice" className="j-iconbtn">
          Registru
        </Link>
      </div>
      {snapshot.foia.length ? (
        <div className="space-y-2">
          {snapshot.foia.map((item) => (
            <Link key={item.id} href={item.href} className="j-feed-item">
              <p className="text-sm font-semibold text-white">544 / {item.requestNumber}</p>
              <p className="text-sm text-slate-300">{item.requesterName}</p>
              <p className="text-xs text-slate-500">
                {item.receivedAtLabel} · termen {item.deadlineLabel}
                {item.overdue ? " · DEPĂȘIT" : ""}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">Nicio solicitare deschisă.</p>
      )}
    </section>
  );
}

function ReportsSection({
  snapshot,
}: {
  snapshot: NonNullable<ReturnType<typeof useJarvisSnapshot>["snapshot"]>;
}) {
  const rows = [
    ["Comunicate", snapshot.counts.comunicateMonth],
    ["Comunicate astăzi", snapshot.counts.comunicateToday],
    ["544 deschise", snapshot.counts.foiaOpen],
    ["Activități 14 zile", snapshot.counts.activitiesNext14],
    ["Apariții negative", snapshot.counts.mediaNegative],
  ] as const;

  return (
    <section className="j-glass j-section">
      <h2 className="jarvis-display text-xl text-white">Raportări — {snapshot.monthLabel}</h2>
      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label} className="j-glass px-3 py-3">
            <dt className="jarvis-label">{label}</dt>
            <dd className="jarvis-display mt-1 text-3xl text-teal-100">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/jarvis/export" className="j-iconbtn primary">
          Export raportare
        </Link>
        <Link href="/dashboard/raportari" className="j-iconbtn">
          Generează raportarea
        </Link>
      </div>
    </section>
  );
}

function DocumentsSection({
  snapshot,
}: {
  snapshot: NonNullable<ReturnType<typeof useJarvisSnapshot>["snapshot"]>;
}) {
  return (
    <section className="j-glass j-section">
      <h2 className="jarvis-display text-xl text-white">Conformitate IRP</h2>
      <ul className="mt-4 space-y-2">
        {snapshot.compliance.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-white/5 px-3 py-2.5">
            <div>
              <p className="text-sm text-white">
                {COMPLIANCE_MARK[item.status] || "·"} {item.title}
              </p>
              <p className="text-xs text-slate-400">{item.detail}</p>
            </div>
            {item.href ? (
              <Link href={item.href} className="j-iconbtn">
                Open
              </Link>
            ) : (
              <CircleDashed size={16} className="mt-1 text-slate-600" />
            )}
          </li>
        ))}
      </ul>
      <p className="mt-4 inline-flex items-center gap-1 text-xs text-slate-500">
        <CheckCircle2 size={13} /> Mapă comunicate și registru 544 se alimentează din aplicație.
      </p>
    </section>
  );
}
