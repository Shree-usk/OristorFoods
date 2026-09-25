const WHOLE_COUNT_UNITS = new Set([
  "egg",
  "eggs",
  "clove",
  "cloves",
  "piece",
  "pieces",
  "whole",
  "large",
  "medium",
  "small",
]);

/** Pure scaling math — no rounding here; `formatScaledQuantity` rounds for display. */
export function scaleQuantity(baseQuantity: number, baseServings: number, targetServings: number): number {
  if (baseServings <= 0) return baseQuantity;
  return baseQuantity * (targetServings / baseServings);
}

/**
 * "3" for whole-count units, "1.5" (never "1.50") for everything else.
 * A whole-count unit never displays "0" — a positive scaled quantity that
 * rounds down to zero (e.g. 0.3 "whole") clamps up to 1 instead.
 */
export function formatScaledQuantity(scaled: number, unit: string | null): string {
  if (unit && WHOLE_COUNT_UNITS.has(unit.toLowerCase())) {
    const rounded = Math.round(scaled);
    return String(scaled > 0 ? Math.max(1, rounded) : rounded);
  }
  return String(Math.round(scaled * 10) / 10);
}

/**
 * Composes the rendered ingredient line from its parts. `displayText` is
 * always the ingredient's authored name/description — never a linked
 * product's catalogue name (see docs/architecture-decisions.md's
 * `displayText` contract).
 */
export function formatIngredientLine(
  ingredient: { quantity: number | null; unit: string | null; displayText: string },
  displayQuantity: string | null,
): string {
  if (displayQuantity !== null && ingredient.unit) {
    return `${displayQuantity} ${ingredient.unit} ${ingredient.displayText}`;
  }
  if (displayQuantity !== null) {
    return `${displayQuantity} ${ingredient.displayText}`;
  }
  return ingredient.displayText;
}
