"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RecipeAssistantWidget } from "@/components/storefront/ai/recipe-assistant-widget";
import type { RecipeFacetOption } from "@/types/recipe";

interface RecipeAssistantTriggerProps {
  dietaryTagOptions: RecipeFacetOption[];
  categoryOptions: RecipeFacetOption[];
}

export function RecipeAssistantTrigger({ dietaryTagOptions, categoryOptions }: RecipeAssistantTriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} className="gap-2">
        <Sparkles className="size-4" aria-hidden="true" />
        Ask the Recipe Assistant
      </Button>
      <RecipeAssistantWidget open={open} onOpenChange={setOpen} dietaryTagOptions={dietaryTagOptions} categoryOptions={categoryOptions} />
    </>
  );
}
