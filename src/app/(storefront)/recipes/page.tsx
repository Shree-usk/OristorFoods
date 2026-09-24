import type { Metadata } from "next";

import { Section } from "@/components/storefront/layout/section";
import { ItemListJsonLd } from "@/components/storefront/product/item-list-json-ld";
import { RecipeListing } from "@/components/storefront/recipes/recipe-listing";
import { listRecipeFacets, listRecipes } from "@/services/recipe.service";
import { recipeListingQuerySchema } from "@/validation/recipe-listing.schema";

export const metadata: Metadata = {
  title: "Recipes",
  description:
    "Authentic Sri Lankan recipes made with Oristor products: curries, rice, sambols, snacks, sweets and drinks. Filter by time, difficulty and dietary needs.",
  alternates: { canonical: "/recipes" },
};

interface RecipesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RecipesPage({ searchParams }: RecipesPageProps) {
  // Same schema as GET /api/recipes, so the first render and every later
  // client fetch agree on filters, defaults and fallbacks.
  const query = recipeListingQuerySchema.parse(await searchParams);
  const [result, facets] = await Promise.all([listRecipes(query), listRecipeFacets()]);

  return (
    <Section>
      <ItemListJsonLd items={result.recipes.map((recipe) => ({ href: recipe.href, name: recipe.title }))} />
      <h1 className="text-h1 font-heading text-charcoal">Recipe Centre</h1>
      <p className="mt-2 max-w-2xl text-body text-charcoal/80">
        Authentic Sri Lankan dishes, from weeknight curries to festival sweets, made with Oristor spices and pantry staples.
      </p>
      <div className="mt-8">
        <RecipeListing initialData={result} facets={facets} />
      </div>
    </Section>
  );
}
