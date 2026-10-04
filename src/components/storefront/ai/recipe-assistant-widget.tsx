"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCart } from "@/hooks/use-cart";
import { useRecipeAssistant } from "@/hooks/use-recipe-assistant";
import { toggleValue } from "@/lib/toggle-value";
import type { RecipeAssistantRecipeCard } from "@/lib/api/recipe-assistant-client";
import type { RecipeFacetOption } from "@/types/recipe";

interface RecipeAssistantWidgetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dietaryTagOptions: RecipeFacetOption[];
  categoryOptions: RecipeFacetOption[];
}

/**
 * STORY-062. No raw token streaming — see
 * docs/architecture-decisions.md. A "thinking" indicator shows while
 * a request is in flight; the complete, server-guardrail-validated
 * message renders once it returns, never partial tokens.
 */
export function RecipeAssistantWidget({ open, onOpenChange, dietaryTagOptions, categoryOptions }: RecipeAssistantWidgetProps) {
  const { messages, sendMessage, isSending, restored, error } = useRecipeAssistant();
  const [input, setInput] = useState("");
  const [dietaryTagSlugs, setDietaryTagSlugs] = useState<string[]>([]);
  const [categorySlug, setCategorySlug] = useState<string | null>(null);

  function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;
    sendMessage(trimmed, { dietaryTagSlugs, categorySlug });
    setInput("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label="Recipe Assistant" className="flex max-h-[85vh] flex-col sm:max-w-lg">
        <h2 className="text-h4 font-heading text-charcoal">Recipe Assistant</h2>
        <p className="text-small text-charcoal/70">
          Tell me what you have, a dietary need, or an occasion, and I&apos;ll suggest Oristor recipes.
        </p>
        <p className="text-caption text-charcoal/60">
          This is an AI assistant — it can make mistakes, so double-check before you cook. Conversations are saved to help us improve it.
        </p>

        {(dietaryTagOptions.length > 0 || categoryOptions.length > 0) && (
          <div className="flex flex-wrap gap-2">
            {categoryOptions.map((option) => (
              <button
                key={option.slug}
                type="button"
                onClick={() => setCategorySlug(categorySlug === option.slug ? null : option.slug)}
                aria-pressed={categorySlug === option.slug}
                className={
                  categorySlug === option.slug
                    ? "rounded-full bg-primary px-3 py-1 text-caption text-primary-foreground"
                    : "rounded-full border border-cream-dark px-3 py-1 text-caption text-charcoal hover:bg-muted"
                }
              >
                {option.name}
              </button>
            ))}
            {dietaryTagOptions.map((option) => (
              <button
                key={option.slug}
                type="button"
                onClick={() => setDietaryTagSlugs((prev) => toggleValue(prev, option.slug))}
                aria-pressed={dietaryTagSlugs.includes(option.slug)}
                className={
                  dietaryTagSlugs.includes(option.slug)
                    ? "rounded-full bg-primary px-3 py-1 text-caption text-primary-foreground"
                    : "rounded-full border border-cream-dark px-3 py-1 text-caption text-charcoal hover:bg-muted"
                }
              >
                {option.name}
              </button>
            ))}
          </div>
        )}

        <div aria-live="polite" className="flex-1 overflow-y-auto rounded-lg bg-cream/50 p-3" style={{ minHeight: "16rem" }}>
          {!restored && <p className="text-small text-charcoal/70">Loading…</p>}
          {restored && messages.length === 0 && <p className="text-small text-charcoal/70">Ask me anything about Oristor recipes.</p>}
          <ul className="flex flex-col gap-3">
            {messages.map((item) => (
              <li key={item.id} className={item.role === "user" ? "ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-small text-primary-foreground" : "mr-auto max-w-[90%] rounded-lg bg-background px-3 py-2 text-small text-charcoal"}>
                <p>{item.content}</p>
                {item.recipes && item.recipes.length > 0 && (
                  <div className="mt-2 flex flex-col gap-2">
                    {item.recipes.map((recipe) => (
                      <RecipeGapCard key={recipe.id} recipe={recipe} />
                    ))}
                  </div>
                )}
              </li>
            ))}
            {isSending && (
              <li className="mr-auto max-w-[90%] rounded-lg bg-background px-3 py-2 text-small text-charcoal/70">Thinking…</li>
            )}
          </ul>
        </div>

        {error && <p className="text-small text-destructive">{error}</p>}

        <form onSubmit={handleSend} className="flex gap-2">
          <Input
            aria-label="Message the Recipe Assistant"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="e.g. I have chicken and coconut milk…"
            disabled={isSending}
          />
          <Button type="submit" disabled={isSending || !input.trim()}>
            Send
          </Button>
        </form>

        <Link href="/recipes" className="text-caption text-chilli hover:underline">
          Browse the Recipe Centre instead
        </Link>
      </DialogContent>
    </Dialog>
  );
}

function RecipeGapCard({ recipe }: { recipe: RecipeAssistantRecipeCard }) {
  const { addItem, isAddingItem } = useCart();

  return (
    <div className="rounded-lg border border-cream-dark bg-background p-2">
      <Link href={`/recipes/${recipe.slug}`} className="flex gap-3 hover:bg-muted">
        <span className="relative size-14 shrink-0 overflow-hidden rounded bg-cream">
          <Image src={recipe.heroImage} alt="" fill sizes="56px" className="object-cover" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-small font-medium text-charcoal">{recipe.title}</p>
          <p className="text-caption text-charcoal/70">
            {recipe.difficulty} · {recipe.totalTimeMinutes} min
          </p>
          {recipe.productsOwned.length > 0 && (
            <p className="text-caption text-charcoal/70">Already have: {recipe.productsOwned.map((p) => p.name).join(", ")}</p>
          )}
        </div>
      </Link>
      {recipe.productsNeeded.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {recipe.productsNeeded.map((product) => (
            <li key={product.id} className="flex items-center justify-between gap-2 text-caption text-charcoal">
              <span>{product.name}</span>
              <Button type="button" size="sm" variant="outline" disabled={isAddingItem} onClick={() => addItem(product.id, 1)}>
                Add to Cart
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
