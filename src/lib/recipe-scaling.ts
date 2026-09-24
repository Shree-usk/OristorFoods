const WHOLE_COUNT_UNITS = new Set(["egg", "eggs", "clove", "cloves", "piece", "pieces"]);

/** Pure scaling math — no rounding here; `formatScaledQuantity` rounds for display. */
export function scaleQuantity(baseQuantity: number, baseServings: number, targetServings: number): number {
  if (baseServings <= 0) return baseQuantity;
  return baseQuantity * (targetServings / baseServings);
}

/** "3" for whole-count units, "1.5" (never "1.50") for everything else. */
export function formatScaledQuantity(scaled: number, unit: string | null): string {
  if (unit && WHOLE_COUNT_UNITS.has(unit.toLowerCase())) {
    return String(Math.round(scaled));
  }
  return String(Math.round(scaled * 10) / 10);
}

export function scaleNutritionValue(
  baseValue: number | null,
  baseServings: number,
  targetServings: number,
): number | null {
  if (baseValue === null) return null;
  return Math.round(scaleQuantity(baseValue, baseServings, targetServings));
}
