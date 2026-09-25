import type { Metadata } from "next";
import { Clock, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/storefront/layout/breadcrumbs";
import { Section } from "@/components/storefront/layout/section";
import { ChefNotes } from "@/components/storefront/recipes/chef-notes";
import { MethodSteps } from "@/components/storefront/recipes/method-steps";
import { RecipeDetailView } from "@/components/storefront/recipes/recipe-detail-view";
import { RecipeHero } from "@/components/storefront/recipes/recipe-hero";
import { RecipeJsonLd } from "@/components/storefront/recipes/recipe-json-ld";
import { RelatedRecipes } from "@/components/storefront/recipes/related-recipes";
import { formatRecipeTime } from "@/lib/recipe-time";
import { getRecipeBySlug } from "@/services/recipe.service";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://oristor.com";

// generateMetadata and the page body both need the recipe; cache() dedupes
// the fetch (including the related-recipes lookup and the view-count
// increment) to one call per request instead of running it twice.
const getCachedRecipe = cache(getRecipeBySlug);

interface RecipeDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: RecipeDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const recipe = await getCachedRecipe(slug);
  if (!recipe) return {};
  return {
    title: recipe.metaTitle ?? recipe.title,
    description: recipe.metaDescription ?? recipe.shortDescription,
  };
}

export default async function RecipeDetailPage({ params }: RecipeDetailPageProps) {
  const { slug } = await params;
  const recipe = await getCachedRecipe(slug);
  if (!recipe) notFound();

  const pageUrl = `${SITE_URL}/recipes/${recipe.slug}`;

  return (
    <Section>
      <RecipeJsonLd
        name={recipe.title}
        description={recipe.shortDescription}
        imageUrls={[recipe.heroImage, ...recipe.galleryImageUrls]}
        totalTimeMinutes={recipe.totalTimeMinutes}
        recipeYield={recipe.servings}
        ingredientTexts={recipe.ingredients.map((i) => i.displayText)}
        instructionTexts={recipe.steps.map((s) => s.instruction)}
        nutritionCalories={recipe.nutrition.calories}
        averageRating={recipe.avgRating ?? undefined}
        ratingCount={recipe.ratingCount > 0 ? recipe.ratingCount : undefined}
      />
      <div className="print:hidden">
        <Breadcrumbs
          items={[
            { name: recipe.categoryName, href: `/recipes?category=${recipe.categorySlug}` },
            { name: recipe.title, href: recipe.href },
          ]}
        />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <RecipeHero heroImage={recipe.heroImage} heroImageAlt={recipe.heroImageAlt} galleryImageUrls={recipe.galleryImageUrls} />
        <div>
          <p className="text-caption font-medium text-chilli">
            <span>{recipe.categoryName}</span>
            {recipe.cuisine && (
              <>
                <span aria-hidden="true"> · </span>
                <span className="text-charcoal/70">{recipe.cuisine}</span>
              </>
            )}
          </p>
          <h1 className="mt-1 text-h1 font-heading text-charcoal">{recipe.title}</h1>
          <p className="mt-2 text-body text-charcoal/80">{recipe.shortDescription}</p>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-small text-charcoal/80">
            <Badge variant="outline">{recipe.difficulty}</Badge>
            <span className="flex items-center gap-1">
              <Clock className="size-4" aria-hidden="true" />
              Prep {formatRecipeTime(recipe.prepTimeMinutes)} · Cook {formatRecipeTime(recipe.cookTimeMinutes)} · Total{" "}
              {formatRecipeTime(recipe.totalTimeMinutes)}
            </span>
            <span className="flex items-center gap-1">
              <Users className="size-4" aria-hidden="true" />
              Serves {recipe.servings}
            </span>
          </div>

          {recipe.dietaryTags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {recipe.dietaryTags.map((tag) => (
                <Badge key={tag.slug} variant="secondary">
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-10">
        <RecipeDetailView recipe={recipe} pageUrl={pageUrl} />
      </div>
      <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="text-h3 font-heading text-charcoal">Method</h2>
          <div className="mt-3">
            <MethodSteps steps={recipe.steps} />
          </div>
          <div className="mt-8">
            <ChefNotes notes={recipe.chefNotes} />
          </div>
        </div>
      </div>
      <div className="mt-10">
        <RelatedRecipes recipes={recipe.relatedRecipes} />
      </div>
    </Section>
  );
}
