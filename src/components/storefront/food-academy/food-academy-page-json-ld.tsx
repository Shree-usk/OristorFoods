import { JsonLdScript } from "@/components/storefront/product/json-ld-script";
import { SITE_URL } from "@/lib/site-url";

interface FoodAcademyPageJsonLdProps {
  name: string;
  description: string;
}

/**
 * Page-level structured data for the /food-academy hub itself — a
 * `CollectionPage` of content tiles, distinct from the per-entry
 * `Article`/`LearningResource` schema in food-academy-json-ld.tsx and the
 * per-result `ItemList` the hub page already emits over its results grid.
 */
export function FoodAcademyPageJsonLd({ name, description }: FoodAcademyPageJsonLdProps) {
  const json = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url: `${SITE_URL}/food-academy`,
  };

  return <JsonLdScript data={json} />;
}
