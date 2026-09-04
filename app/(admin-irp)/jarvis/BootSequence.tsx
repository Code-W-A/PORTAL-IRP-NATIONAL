"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { hasJarvisBootTrack, playJarvisBootAudio } from "./_core/bootAudio";

const LETTERS = ["J", "A", "R", "V", "I", "S"];

const SYSTEMS = [
  { id: "kernel", label: "IRP OS kernel", pct: 100 },
  { id: "drive", label: "Drive archive link", pct: 94 },
  { id: "cal", label: "Calendar IGSU sync", pct: 88 },
  { id: "expo", label: "Expo SMS bridge", pct: 76 },
  { id: "foia", label: "544 legal lock", pct: 100 },
  { id: "media", label: "Media radar", pct: 81 },
];

const MODULES = [
  { label: "Drive", top: "18%", left: "18%" },
  { label: "Calendar", top: "16%", right: "16%" },
  { label: "Expo", bottom: "22%", left: "14%" },
  { label: "544", bottom: "20%", right: "14%" },
  { label: "BICP", top: "38%", left: "7%" },
  { label: "Canva", top: "38%", right: "7%" },
];

const LOG_LINES = [
  "handshake  ·  Drive / Calendar / Expo",
  "tenant ISU  ·  telemetry channel open",
  "human approval lock  ·  ARMED",
  "draft engines  ·  standby",
  "JARVIS  ·  all primary systems online",
];

type BootPhase = "idle" | "running" | "exiting";

export default function BootSequence({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<BootPhase>("idle");
  const [hasTrack, setHasTrack] = useState<boolean | null>(null);
  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [clock, setClock] = useState("");
  const timersRef = useRef<number[]>([]);
  const progressRef = useRef<number | null>(null);

  const rain = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) =>
        Array.from({ length: 28 }, () => (Math.random() > 0.5 ? "1" : "0")).join("  ") + (i % 3 === 0 ? "\n" : "")
      ).join("\n"),
    []
  );

  const ticks = useMemo(() => Array.from({ length: 36 }, (_, i) => i), []);

  useEffect(() => {
    let cancelled = false;
    void hasJarvisBootTrack().then((ok) => {
      if (!cancelled) setHasTrack(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(
        now.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
      if (progressRef.current != null) window.clearInterval(progressRef.current);
    };
  }, []);

  async function engage() {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
    if (progressRef.current != null) window.clearInterval(progressRef.current);
    const later = (fn: () => void, ms: number) => {
      timersRef.current.push(window.setTimeout(fn, ms));
    };

    setPhase("running");
    setStep(0);
    setProgress(4);

    later(() => setStep(1), 180);
    later(() => setStep(2), 480);
    later(() => setStep(3), 820);
    later(() => setStep(4), 1200);
    later(() => setStep(5), 1680);
    later(() => setStep(6), 2200);
    later(() => setStep(7), 2800);
    later(() => setStep(8), 3600);
    later(() => setStep(9), 4600);
    later(() => setProgress(100), 6000);
    later(() => setPhase("exiting"), 6200);
    later(() => onDone(), 6900);

    progressRef.current = window.setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 100 : prev + 2));
    }, 90);
    later(() => {
      if (progressRef.current != null) {
        window.clearInterval(progressRef.current);
        progressRef.current = null;
      }
    }, 6100);

    try {
      await playJarvisBootAudio();
    } catch {
      // Visual boot still runs if audio is blocked.
    }
  }

  const visibleLogs = LOG_LINES.slice(0, Math.max(0, step - 3));
  const visibleLetters = phase === "idle" ? LETTERS.length : Math.min(LETTERS.length, Math.max(1, step));
  const visibleModules = phase === "idle" ? 0 : Math.max(0, step - 2);

  return (
    <div
      className={`jarvis-boot ${phase === "idle" ? "is-idle" : ""} ${phase === "running" ? "is-running" : ""} ${
        phase === "exiting" ? "is-exiting" : ""
      }`}
      role="dialog"
      aria-label="Pornire JARVIS"
    >
      <div className="jarvis-boot-stars" />
      <div className="jarvis-boot-grid" />
      <div className="jarvis-hex-floor" />
      <div className="jarvis-rain">{rain}</div>
      <div className="jarvis-scanbeam" />

      <div className="jarvis-corner jarvis-c-tl" />
      <div className="jarvis-corner jarvis-c-tr" />
      <div className="jarvis-corner jarvis-c-bl" />
      <div className="jarvis-corner jarvis-c-br" />

      <div className={`jarvis-topbar ${phase !== "idle" && step >= 1 ? "show" : ""}`}>
        <span>IRP OS 7.4.1</span>
        <span>SEC / NESECRET</span>
        <span>{clock || "--:--:--"}</span>
      </div>

      <div className="jarvis-core">
        <div className="jarvis-radar" />
        <div className="jarvis-ring jarvis-ring-d" />
        <div className="jarvis-ring jarvis-ring-c" />
        <div className="jarvis-ring jarvis-ring-b" />
        <div className="jarvis-ring jarvis-ring-a" />
        <div className="jarvis-ticks">
          {ticks.map((i) => (
            <span key={i} style={{ transform: `rotate(${i * 10}deg) translateY(-50%)` }} />
          ))}
        </div>
        {step >= 4 && <div className="jarvis-reticle" />}
      </div>

      {MODULES.slice(0, visibleModules).map((mod, index) => (
        <div
          key={mod.label}
          className="jarvis-orbit-node"
          style={{
            top: "top" in mod ? mod.top : undefined,
            bottom: "bottom" in mod ? mod.bottom : undefined,
            left: "left" in mod ? mod.left : undefined,
            right: "right" in mod ? mod.right : undefined,
            animationDelay: `${index * 90}ms`,
          }}
        >
          <b />
          {mod.label}
        </div>
      ))}

      <aside className={`jarvis-side jarvis-side-left ${step >= 3 ? "show" : ""}`}>
        {SYSTEMS.map((sys, index) =>
          step >= 3 + Math.floor(index / 2) ? (
            <div key={sys.id} className="jarvis-sys">
              <div>
                {sys.label}  ·  {sys.pct}%
              </div>
              <div className="jarvis-sys-bar">
                <i style={{ width: `${sys.pct}%`, animationDelay: `${index * 80}ms` }} />
              </div>
            </div>
          ) : null
        )}
      </aside>

      <aside className={`jarvis-side jarvis-side-right ${step >= 4 ? "show" : ""}`}>
        <p>COORD  44.92 N / 25.45 E</p>
        <p>TENANT  DB / ISU</p>
        <p>UPLINK  4 CHANNELS</p>
        <p>LOCK    HUMAN / ON</p>
        <div className="mt-4 space-y-1 text-sky-300/80">
          {visibleLogs.map((line) => (
            <p key={line}>› {line}</p>
          ))}
        </div>
      </aside>

      <div className="jarvis-boot-copy">
        <p className="jarvis-label">Inspectorate  ·  Command nucleus</p>
        <div className="jarvis-display jarvis-letters mt-2">
          {LETTERS.slice(0, visibleLetters).map((letter, index) => (
            <span key={letter} style={{ animationDelay: `${index * 90}ms` }}>
              {letter}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[11px] uppercase tracking-[0.28em] text-sky-300/75">
          Just A Rather Very Intelligent System
        </p>

        {phase === "idle" ? (
          <>
            <p className="mt-6 text-sm text-sky-100/70">
              {hasTrack
                ? "Track local locked. Engage pornește nucleul și audio-ul."
                : "Fără boot.mp3 — Engage pornește sting-ul intern."}
            </p>
            <div className="jarvis-engage-wrap">
              <span className="jarvis-engage-spin" />
              <button type="button" className="jarvis-engage" onClick={() => void engage()}>
                Engage
              </button>
            </div>
          </>
        ) : (
          <p className="mt-6 text-xs uppercase tracking-[0.24em] text-amber-200/80">
            {step < 8 ? "Initializing primary systems" : "All systems online"}
          </p>
        )}
      </div>

      <div className={`jarvis-progress ${step >= 2 ? "show" : ""}`}>
        <div className="mb-2 flex justify-between text-[10px] uppercase tracking-[0.22em] text-sky-300/70">
          <span>Core boot</span>
          <span>{Math.min(100, progress)}%</span>
        </div>
        <div className="jarvis-progress-track">
          <div className="jarvis-progress-fill" style={{ width: `${Math.min(100, progress)}%` }} />
        </div>
      </div>
    </div>
  );
}
