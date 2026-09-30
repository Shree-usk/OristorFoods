import type { Metadata } from "next";
import { Clock, Users } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/storefront/layout/section";
import { ChefNotes } from "@/components/storefront/recipes/chef-notes";
import { MethodSteps } from "@/components/storefront/recipes/method-steps";
import { RecipeDetailView } from "@/components/storefront/recipes/recipe-detail-view";
import { RecipeHero } from "@/components/storefront/recipes/recipe-hero";
import { formatRecipeTime } from "@/lib/recipe-time";
import { adminAuth } from "@/lib/admin-auth";
import { hasPermission } from "@/services/permission.service";
import { RecipeAdminNotFoundError } from "@/services/recipe-admin.errors";
import { getRecipeForPreview } from "@/services/recipe-admin.service";

export const metadata: Metadata = {
  title: "Preview | Recipe | Admin",
  robots: { index: false, follow: false },
};

/**
 * Admin-only preview of a recipe at any status — server-renders the real
 * storefront presentational components (RecipeHero, RecipeDetailView,
 * MethodSteps, ChefNotes) against non-published data, same
 * "server-render the real components, admin-only route" pattern as
 * STORY-042's homepage preview. Skips the customer-account-dependent
 * pieces (reviews section, bookmark button, rating stars) that don't
 * apply to a recipe nobody outside the team can see yet.
 */
export default async function AdminRecipePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");
  if (!(await hasPermission(session.user.id, "Recipes", "View"))) redirect("/admin");

  const { id } = await params;
  let recipe;
  try {
    recipe = await getRecipeForPreview(session.user.id, id);
  } catch (error) {
    if (error instanceof RecipeAdminNotFoundError) notFound();
    throw error;
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border bg-beige px-4 py-3">
        <p className="text-small text-charcoal">Previewing recipe — not the live storefront.</p>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/admin/recipes/${id}`} />}>
          Back to editor
        </Button>
      </div>
      <Section>
        <div className="mt-6 grid grid-cols-1 gap-10 lg:grid-cols-2">
          <RecipeHero heroImage={recipe.heroImage} heroImageAlt={recipe.heroImageAlt} galleryImageUrls={recipe.galleryImageUrls} video={recipe.video} />
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
                Prep {formatRecipeTime(recipe.prepTimeMinutes)} · Cook {formatRecipeTime(recipe.cookTimeMinutes)} · Total {formatRecipeTime(recipe.totalTimeMinutes)}
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
          <RecipeDetailView recipe={recipe} pageUrl="" />
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
      </Section>
    </div>
  );
}
