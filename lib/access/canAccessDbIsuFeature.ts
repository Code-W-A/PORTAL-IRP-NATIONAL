export function canAccessDbIsuFeature(
  ctx: { judetId: string; structuraId: string },
  isAdmin: boolean
): boolean {
  const judetId = String(ctx.judetId || "").toUpperCase();
  const structuraId = String(ctx.structuraId || "").toUpperCase();
  return isAdmin && judetId === "DB" && structuraId === "ISU";
}
