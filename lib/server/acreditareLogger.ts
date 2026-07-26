export type AcreditareLogLevel = "info" | "warn" | "error";

export type AcreditareLogTenant = {
  judetId?: string;
  structuraId?: string;
  uid?: string;
};

type LoggerOpts = {
  area: string;
  requestId?: string;
  tenant?: AcreditareLogTenant;
};

const SENSITIVE_KEY =
  /^(authorization|cookie|token|password|smtp_pass|smtpPass|secret|private[_-]?key|acreditarePdfToken|downloadToken)$/i;

const MAX_STRING = 400;

function truncate(value: string, max = MAX_STRING): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function maskPhone(value: unknown): string | undefined {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.length <= 4) return `***${digits}`;
  return `***${digits.slice(-4)}`;
}

function maskEmail(value: unknown): string | undefined {
  const s = String(value || "").trim().toLowerCase();
  if (!s || !s.includes("@")) return s ? "***" : undefined;
  const [user, domain] = s.split("@");
  if (!user || !domain) return "***";
  const head = user.slice(0, 2);
  return `${head}***@${domain}`;
}

/** Sanitize meta for logs: strip secrets, truncate, lightly mask contacts. */
export function safeLogMeta(meta?: Record<string, unknown> | null): Record<string, unknown> {
  if (!meta || typeof meta !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(meta)) {
    if (SENSITIVE_KEY.test(key)) continue;
    if (raw === undefined) continue;

    const lower = key.toLowerCase();
    if (lower === "email" || lower === "to" || lower.endsWith("email")) {
      if (typeof raw === "boolean") {
        out[key] = raw;
      } else if (raw == null || raw === "") {
        out[key] = null;
      } else {
        out.hasEmail = true;
        out[key] = maskEmail(raw);
      }
      continue;
    }
    if (lower === "telefon" || lower === "phone" || lower.endsWith("telefon") || lower.endsWith("phone")) {
      if (raw == null || raw === "") {
        out[key] = null;
      } else {
        out.hasPhone = true;
        out[key] = maskPhone(raw);
      }
      continue;
    }
    if (lower === "downloadurl" || lower === "url") {
      // Keep path shape, drop query/hash secrets.
      try {
        const u = new URL(String(raw));
        out[key] = `${u.origin}${u.pathname}`;
      } catch {
        out[key] = truncate(String(raw), 120);
      }
      continue;
    }
    if (typeof raw === "string") {
      out[key] = truncate(raw);
      continue;
    }
    if (raw instanceof Error) {
      out[key] = truncate(`${raw.name}: ${raw.message}`);
      if (raw.stack) out[`${key}Stack`] = truncate(raw.stack, 800);
      continue;
    }
    if (typeof raw === "object" && raw !== null) {
      try {
        out[key] = JSON.parse(truncate(JSON.stringify(raw), 800));
      } catch {
        out[key] = "[unserializable]";
      }
      continue;
    }
    out[key] = raw;
  }
  return out;
}

export function newAcreditareRequestId(prefix: string): string {
  const p = String(prefix || "acr").replace(/[^a-z0-9_-]/gi, "_").slice(0, 40);
  return `${p}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

export type AcreditareLogger = {
  requestId: string;
  area: string;
  info: (action: string, meta?: Record<string, unknown>) => void;
  warn: (action: string, meta?: Record<string, unknown>) => void;
  error: (action: string, meta?: Record<string, unknown>) => void;
  child: (extra: Partial<LoggerOpts> & { area?: string }) => AcreditareLogger;
};

function emit(
  level: AcreditareLogLevel,
  opts: LoggerOpts & { action: string; meta?: Record<string, unknown> }
) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    domain: "acreditari",
    area: opts.area,
    action: opts.action,
    requestId: opts.requestId || undefined,
    judetId: opts.tenant?.judetId || undefined,
    structuraId: opts.tenant?.structuraId || undefined,
    uid: opts.tenant?.uid || undefined,
    ...safeLogMeta(opts.meta),
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error("[acreditari]", line);
  else if (level === "warn") console.warn("[acreditari]", line);
  else console.log("[acreditari]", line);
}

export function createAcreditareLogger(opts: LoggerOpts): AcreditareLogger {
  const requestId = opts.requestId || newAcreditareRequestId(opts.area || "acr");
  const base: LoggerOpts = {
    area: opts.area,
    requestId,
    tenant: opts.tenant,
  };

  return {
    requestId,
    area: base.area,
    info(action, meta) {
      emit("info", { ...base, action, meta });
    },
    warn(action, meta) {
      emit("warn", { ...base, action, meta });
    },
    error(action, meta) {
      emit("error", { ...base, action, meta });
    },
    child(extra) {
      return createAcreditareLogger({
        area: extra.area || base.area,
        requestId: extra.requestId || base.requestId,
        tenant: { ...(base.tenant || {}), ...(extra.tenant || {}) },
      });
    },
  };
}

/** Compact error fields for catch blocks. */
export function errorLogFields(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return {
      message: truncate(err.message || "error"),
      name: err.name,
      stack: err.stack ? truncate(err.stack, 800) : undefined,
    };
  }
  return { message: truncate(String(err || "error")) };
}
