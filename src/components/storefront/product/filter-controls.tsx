"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import { toggleValue } from "@/lib/toggle-value";

export interface FilterOptionGroup {
  label: string;
  options: Array<{ value: string; label: string }>;
}

export interface FilterValues {
  priceMin?: number;
  priceMax?: number;
  allergens: string[];
  certifications: string[];
  brands: string[];
  inStock: boolean;
}

const emptyFilterValues: FilterValues = {
  priceMin: undefined,
  priceMax: undefined,
  allergens: [],
  certifications: [],
  brands: [],
  inStock: false,
};

interface FilterControlsProps {
  values: FilterValues;
  onChange: (values: FilterValues) => void;
  allergenOptions: FilterOptionGroup["options"];
  certificationOptions: FilterOptionGroup["options"];
  brandOptions: FilterOptionGroup["options"];
}

export function FilterControls({
  values,
  onChange,
  allergenOptions,
  certificationOptions,
  brandOptions,
}: FilterControlsProps) {
  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-small font-medium text-charcoal">Price Range</legend>
        <div className="flex items-center gap-2">
          <Label htmlFor="price-min" className="sr-only">
            Minimum price
          </Label>
          <Input
            id="price-min"
            type="number"
            min={0}
            placeholder="Min"
            value={values.priceMin ?? ""}
            onChange={(event) =>
              onChange({
                ...values,
                priceMin: event.target.value === "" ? undefined : Number(event.target.value),
              })
            }
          />
          <span aria-hidden="true">–</span>
          <Label htmlFor="price-max" className="sr-only">
            Maximum price
          </Label>
          <Input
            id="price-max"
            type="number"
            min={0}
            placeholder="Max"
            value={values.priceMax ?? ""}
            onChange={(event) =>
              onChange({
                ...values,
                priceMax: event.target.value === "" ? undefined : Number(event.target.value),
              })
            }
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-small font-medium text-charcoal">Allergen-Free</legend>
        {allergenOptions.map((option) => (
          <CheckboxOption
            key={option.value}
            label={option.label}
            checked={values.allergens.includes(option.value)}
            onCheckedChange={() =>
              onChange({ ...values, allergens: toggleValue(values.allergens, option.value) })
            }
          />
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-small font-medium text-charcoal">Certifications</legend>
        {certificationOptions.map((option) => (
          <CheckboxOption
            key={option.value}
            label={option.label}
            checked={values.certifications.includes(option.value)}
            onCheckedChange={() =>
              onChange({
                ...values,
                certifications: toggleValue(values.certifications, option.value),
              })
            }
          />
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-small font-medium text-charcoal">Brand</legend>
        {brandOptions.map((option) => (
          <CheckboxOption
            key={option.value}
            label={option.label}
            checked={values.brands.includes(option.value)}
            onCheckedChange={() =>
              onChange({ ...values, brands: toggleValue(values.brands, option.value) })
            }
          />
        ))}
      </fieldset>

      <CheckboxOption
        label="In stock only"
        checked={values.inStock}
        onCheckedChange={(checked) => onChange({ ...values, inStock: checked })}
      />

      <Button type="button" variant="outline" onClick={() => onChange(emptyFilterValues)}>
        Clear filters
      </Button>
    </div>
  );
}
