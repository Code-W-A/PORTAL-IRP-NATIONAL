export type TenantContext = { judetId: string; structuraId: string };

const DEFAULTS: TenantContext = { judetId: "DB", structuraId: "ISU" };

export function getTenantContext(): TenantContext {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const j = localStorage.getItem("tenant:judetId") || DEFAULTS.judetId;
    const s = localStorage.getItem("tenant:structuraId") || DEFAULTS.structuraId;
    return { judetId: j, structuraId: s };
  } catch {
    return DEFAULTS;
  }
}

export function setTenantContext(ctx: TenantContext) {
  if (typeof window === "undefined") return;
  localStorage.setItem("tenant:judetId", ctx.judetId);
  localStorage.setItem("tenant:structuraId", ctx.structuraId);
}

export function interventionTypesCollectionPath(judetId: string, structuraId: string): string {
  return `Judete/${judetId}/Structuri/${structuraId}/InterventiiTipuri`;
}

export function interventionRecordsCollectionPath(judetId: string, structuraId: string): string {
  return `Judete/${judetId}/Structuri/${structuraId}/InterventiiInregistrari`;
}

