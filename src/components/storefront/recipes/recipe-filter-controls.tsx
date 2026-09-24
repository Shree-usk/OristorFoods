"use client";

import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import { Button } from "@/components/ui/button";
import {
  recipeDifficultyLabels,
  recipeDifficultyValues,
  recipeTimeLabels,
  recipeTimeValues,
  type RecipeDifficultyParam,
  type RecipeTimeRange,
} from "@/lib/recipe-listing-values";
import { toggleValue } from "@/lib/toggle-value";
import type { RecipeFacetOption } from "@/types/recipe";

export interface RecipeFilterValues {
  difficulty: RecipeDifficultyParam[];
  time: RecipeTimeRange[];
  /** Dietary tag slugs. */
  diet: string[];
}

interface RecipeFilterControlsProps {
  values: RecipeFilterValues;
  onChange: (values: RecipeFilterValues) => void;
  dietaryTagOptions: RecipeFacetOption[];
  /** Clears every filter, the category and the search. */
  onClear: () => void;
}

export function RecipeFilterControls({ values, onChange, dietaryTagOptions, onClear }: RecipeFilterControlsProps) {
  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-small font-medium text-charcoal">Difficulty</legend>
        {recipeDifficultyValues.map((difficulty) => (
          <CheckboxOption
            key={difficulty}
            label={recipeDifficultyLabels[difficulty]}
            checked={values.difficulty.includes(difficulty)}
            onCheckedChange={() => onChange({ ...values, difficulty: toggleValue(values.difficulty, difficulty) })}
          />
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-small font-medium text-charcoal">Time</legend>
        {recipeTimeValues.map((range) => (
          <CheckboxOption
            key={range}
            label={recipeTimeLabels[range]}
            checked={values.time.includes(range)}
            onCheckedChange={() => onChange({ ...values, time: toggleValue(values.time, range) })}
          />
        ))}
      </fieldset>

      {dietaryTagOptions.length > 0 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-small font-medium text-charcoal">Dietary</legend>
          {dietaryTagOptions.map((tag) => (
            <CheckboxOption
              key={tag.slug}
              label={tag.name}
              checked={values.diet.includes(tag.slug)}
              onCheckedChange={() => onChange({ ...values, diet: toggleValue(values.diet, tag.slug) })}
            />
          ))}
        </fieldset>
      )}

      <Button type="button" variant="outline" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  );
}
