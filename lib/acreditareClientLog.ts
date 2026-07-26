/**
 * Client-side domain logs for acreditări.
 * Uses console so they appear locally and are forwarded by initClientLogger
 * when NEXT_PUBLIC_ENABLE_REMOTE_LOGS=true.
 */

type Level = "info" | "warn" | "error";

const MAX_STRING = 400;

function truncate(value: string, max = MAX_STRING): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function safeMeta(meta?: Record<string, unknown> | null): Record<string, unknown> {
  if (!meta || typeof meta !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(meta)) {
    if (/token|password|secret|authorization/i.test(key)) continue;
    if (raw === undefined) continue;
    if (raw instanceof Error) {
      out[key] = truncate(`${raw.name}: ${raw.message}`);
      continue;
    }
    if (typeof raw === "string") {
      out[key] = truncate(raw);
      continue;
    }
    if (typeof raw === "object" && raw !== null) {
      try {
        out[key] = JSON.parse(truncate(JSON.stringify(raw), 600));
      } catch {
        out[key] = "[unserializable]";
      }
      continue;
    }
    out[key] = raw;
  }
  return out;
}

function emit(level: Level, area: string, action: string, meta?: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    domain: "acreditari",
    area,
    action,
    ...safeMeta(meta),
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error("[acreditari]", line);
  else if (level === "warn") console.warn("[acreditari]", line);
  else console.info("[acreditari]", line);
}

export function acrLog(area: string, action: string, meta?: Record<string, unknown>) {
  emit("info", area, action, meta);
}

export function acrWarn(area: string, action: string, meta?: Record<string, unknown>) {
  emit("warn", area, action, meta);
}

export function acrLogError(
  area: string,
  action: string,
  err?: unknown,
  meta?: Record<string, unknown>
) {
  const errMeta: Record<string, unknown> = { ...(meta || {}) };
  if (err instanceof Error) {
    errMeta.message = truncate(err.message || "error");
    errMeta.name = err.name;
  } else if (err != null) {
    errMeta.message = truncate(String(err));
  }
  emit("error", area, action, errMeta);
}
