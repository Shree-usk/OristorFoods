/**
 * Parses a recipe ingredient quantity typed as a plain decimal ("0.5"), a
 * simple fraction ("1/2"), or a mixed number ("1 1/2") into a plain
 * decimal. RecipeIngredient.quantity is a Decimal(8,2) column used for
 * serving-count scaling elsewhere (see schema.prisma), so only what's
 * *typeable* in the admin form changes — not what's stored.
 *
 * Registered as this field's `setValueAs`, which react-hook-form also runs
 * against the field's *default* value (admin-recipe-form.tsx seeds it with
 * `Number(ingredient.quantity)`, not a string) the first time the
 * Ingredients tab mounts — not just against typed input — so `raw` can
 * arrive as a number or undefined, not only a string.
 */
export function parseQuantityInput(raw: string | number | undefined): number | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw === "number") return Number.isNaN(raw) ? undefined : raw;

  const value = raw.trim();
  if (value === "") return undefined;

  const mixed = value.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const denominator = Number(mixed[3]);
    return denominator === 0 ? NaN : Number(mixed[1]) + Number(mixed[2]) / denominator;
  }

  const fraction = value.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator === 0 ? NaN : Number(fraction[1]) / denominator;
  }

  return Number(value);
}
