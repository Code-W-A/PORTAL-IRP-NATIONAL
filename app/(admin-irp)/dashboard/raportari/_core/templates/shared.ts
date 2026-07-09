export const DEFAULT_UNITATE_LABEL = "ISU DB";

export function propagateUnitateOnRows<T extends { cells: Record<string, string> }>(
  rows: T[],
  fallbackUnitate = DEFAULT_UNITATE_LABEL
): T[] {
  let lastUnitate = fallbackUnitate;
  return rows.map((row) => {
    const unitate = String(row.cells.unitate || "").trim() || lastUnitate;
    if (String(row.cells.unitate || "").trim()) {
      lastUnitate = unitate;
    }
    return {
      ...row,
      cells: {
        ...row.cells,
        unitate,
      },
    };
  });
}
