import type { RecipeNutrition } from "@/types/recipe";

interface NutritionPanelProps {
  nutrition: RecipeNutrition;
  /** Current (possibly scaled) serving count, used only for the total line. */
  servings: number;
}

const ROWS: { key: keyof RecipeNutrition; label: string; suffix: string }[] = [
  { key: "calories", label: "Calories", suffix: "kcal" },
  { key: "protein", label: "Protein", suffix: "g" },
  { key: "carbs", label: "Carbohydrates", suffix: "g" },
  { key: "fat", label: "Fat", suffix: "g" },
  { key: "fiber", label: "Fiber", suffix: "g" },
  { key: "sodium", label: "Sodium", suffix: "mg" },
];

/**
 * Per-serving nutrition values are constant — they don't scale with batch
 * size, only the total across all servings does. The heading lives here
 * (not in the parent) so the same all-null guard that hides the grid also
 * hides the heading.
 */
export function NutritionPanel({ nutrition, servings }: NutritionPanelProps) {
  const rows = ROWS.filter((row) => nutrition[row.key] !== null);
  if (rows.length === 0) return null;

  return (
    <div>
      <h2 className="text-h4 font-heading text-charcoal">Nutrition per serving</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-small text-charcoal sm:grid-cols-3">
        {rows.map((row) => (
          <div key={row.key} className="rounded-lg border border-input p-3">
            <dt className="text-caption text-charcoal/70">{row.label}</dt>
            <dd className="font-number text-body">
              {nutrition[row.key]} {row.suffix}
            </dd>
          </div>
        ))}
      </dl>
      {nutrition.calories !== null && (
        <p className="mt-3 text-caption text-charcoal/70">
          Total for {servings} servings: {nutrition.calories * servings} kcal
        </p>
      )}
    </div>
  );
}
