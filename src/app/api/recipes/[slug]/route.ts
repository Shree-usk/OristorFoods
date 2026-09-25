import { NextResponse } from "next/server";

import { getRecipeBySlug } from "@/services/recipe.service";
import { recipeSlugParamSchema } from "@/validation/recipe-detail.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = recipeSlugParamSchema.parse(await params);

  const recipe = await getRecipeBySlug(slug);
  if (!recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  return NextResponse.json(recipe, { status: 200 });
}
