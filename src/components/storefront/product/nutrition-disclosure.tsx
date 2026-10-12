"use client";

import { ChevronDownIcon } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { NutritionTable } from "@/components/storefront/product/nutrition-table";
import type { ProductDetailNutrition } from "@/services/product.service";

/** Collapsed by default — the full nutrient table isn't what most shoppers scan for first, so it only expands on request. */
export function NutritionDisclosure({ nutrition }: { nutrition: ProductDetailNutrition }) {
  return (
    <Collapsible defaultOpen={false}>
      <CollapsibleTrigger className="group/nutrition-trigger flex w-full items-center justify-between text-left">
        <h2 className="text-h4 font-heading text-charcoal">Nutrition Facts</h2>
        <ChevronDownIcon className="size-5 text-charcoal/60 transition duration-200 group-data-panel-open/nutrition-trigger:rotate-180" aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <NutritionTable nutrition={nutrition} />
      </CollapsibleContent>
    </Collapsible>
  );
}
