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

/**
 * `JSON.stringify` doesn't escape `<`, so a product name or story
 * containing `</script><script>` could break out of this block —
 * replacing `<` with its unicode escape neutralizes that without
 * affecting the parsed JSON. Same technique as ItemListJsonLd (STORY-010).
 */
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

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json).replace(/</g, "\\u003c") }}
    />
  );
}
