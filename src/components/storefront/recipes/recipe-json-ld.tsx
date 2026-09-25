import { JsonLdScript } from "@/components/storefront/product/json-ld-script";

interface RecipeJsonLdProps {
  name: string;
  description: string;
  imageUrls: string[];
  totalTimeMinutes: number;
  recipeYield: number;
  ingredientTexts: string[];
  instructionTexts: string[];
  nutritionCalories: number | null;
  averageRating?: number;
  ratingCount?: number;
}

export function RecipeJsonLd(props: RecipeJsonLdProps) {
  const json = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: props.name,
    description: props.description,
    image: props.imageUrls,
    totalTime: `PT${props.totalTimeMinutes}M`,
    recipeYield: String(props.recipeYield),
    recipeIngredient: props.ingredientTexts,
    recipeInstructions: props.instructionTexts.map((text) => ({ "@type": "HowToStep", text })),
    ...(props.nutritionCalories !== null
      ? { nutrition: { "@type": "NutritionInformation", calories: `${props.nutritionCalories} calories` } }
      : {}),
    ...(props.averageRating !== undefined && props.ratingCount !== undefined
      ? { aggregateRating: { "@type": "AggregateRating", ratingValue: props.averageRating, reviewCount: props.ratingCount } }
      : {}),
  };

  return <JsonLdScript data={json} />;
}
