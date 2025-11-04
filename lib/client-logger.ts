/* Lightweight client logging: captures console + runtime errors and POSTs to /api/logs/ingest
   Enable by setting NEXT_PUBLIC_ENABLE_REMOTE_LOGS=true */

type LogLevel = "log" | "info" | "warn" | "error";

type LogEntry = {
  level: LogLevel;
  message: string;
  meta?: Record<string, unknown>;
  ts: number;
};

function toMessage(args: unknown[]): string {
  try {
    return args
      .map((a) =>
        typeof a === "string" ? a : a instanceof Error ? `${a.name}: ${a.message}\n${a.stack || ""}` : JSON.stringify(a)
      )
      .join(" ");
  } catch {
    return String(args);
  }
}

export function initClientLogger() {
  if (typeof window === "undefined") return;
  const enabled = process.env.NEXT_PUBLIC_ENABLE_REMOTE_LOGS === "true";
  if (!enabled) return;

  const original: Record<LogLevel, (...args: any[]) => void> = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
  };

  async function send(entry: LogEntry) {
    try {
      await fetch("/api/logs/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...entry,
          url: location.href,
          ua: navigator.userAgent,
        }),
        keepalive: true,
      });
    } catch {
      // ignore network issues
    }
  }

  (Object.keys(original) as LogLevel[]).forEach((level) => {
    console[level] = (...args: unknown[]) => {
      const msg = toMessage(args);
      original[level](...args);
      void send({ level, message: msg, ts: Date.now() });
    };
  });

  window.addEventListener("error", (ev) => {
    const msg = ev.error ? `${ev.error.name}: ${ev.error.message}` : ev.message;
    void send({ level: "error", message: `window.onerror: ${msg}`, ts: Date.now() });
  });
  window.addEventListener("unhandledrejection", (ev: PromiseRejectionEvent) => {
    const reason = (ev.reason && (ev.reason.message || ev.reason.toString())) || "unhandledrejection";
    void send({ level: "error", message: `unhandledrejection: ${reason}`, ts: Date.now() });
  });
}


