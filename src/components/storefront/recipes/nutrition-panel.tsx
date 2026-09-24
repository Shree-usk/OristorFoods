import { scaleNutritionValue } from "@/lib/recipe-scaling";
import type { RecipeNutrition } from "@/types/recipe";

interface NutritionPanelProps {
  nutrition: RecipeNutrition;
  baseServings: number;
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

export function NutritionPanel({ nutrition, baseServings, servings }: NutritionPanelProps) {
  const hasAnyValue = ROWS.some((row) => nutrition[row.key] !== null);
  if (!hasAnyValue) return null;

  return (
    <dl className="grid grid-cols-2 gap-3 text-small text-charcoal sm:grid-cols-3">
      {ROWS.filter((row) => nutrition[row.key] !== null).map((row) => (
        <div key={row.key} className="rounded-lg border border-input p-3">
          <dt className="text-caption text-charcoal/70">{row.label}</dt>
          <dd className="font-number text-body">
            {scaleNutritionValue(nutrition[row.key], baseServings, servings)} {row.suffix}
          </dd>
        </div>
      ))}
    </dl>
  );
}
