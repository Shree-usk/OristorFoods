import { JsonLdScript } from "@/components/storefront/product/json-ld-script";

interface ProductJsonLdProps {
  name: string;
  description: string | null;
  imageUrls: string[];
  sku: string;
  price: number;
  currency: string;
  inStock: boolean;
  url: string;
  averageRating?: number;
  reviewCount?: number;
}

export function ProductJsonLd(props: ProductJsonLdProps) {
  const json = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: props.name,
    description: props.description ?? undefined,
    image: props.imageUrls,
    sku: props.sku,
    url: props.url,
    offers: {
      "@type": "Offer",
      price: props.price,
      priceCurrency: props.currency,
      availability: props.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
    ...(props.averageRating !== undefined && props.reviewCount !== undefined
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: props.averageRating,
            reviewCount: props.reviewCount,
          },
        }
      : {}),
  };

  return <JsonLdScript data={json} />;
}
