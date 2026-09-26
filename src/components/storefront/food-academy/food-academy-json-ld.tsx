import { JsonLdScript } from "@/components/storefront/product/json-ld-script";

interface FoodAcademyJsonLdProps {
  name: string;
  description: string;
  imageUrl: string | null;
  authorName: string | null;
  isCourse: boolean;
}

export function FoodAcademyJsonLd({ name, description, imageUrl, authorName, isCourse }: FoodAcademyJsonLdProps) {
  const json = {
    "@context": "https://schema.org",
    "@type": isCourse ? "LearningResource" : "Article",
    name,
    headline: name,
    description,
    ...(imageUrl ? { image: imageUrl } : {}),
    ...(authorName ? { author: { "@type": "Person", name: authorName } } : {}),
  };

  return <JsonLdScript data={json} />;
}
