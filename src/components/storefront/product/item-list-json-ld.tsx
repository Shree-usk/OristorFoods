interface ItemListJsonLdProps {
  items: Array<{ href: string; name: string }>;
}

/**
 * `JSON.stringify` doesn't escape `<`, so a product name containing
 * `</script><script>` could break out of this block — replacing `<` with
 * its unicode escape neutralizes that without affecting the parsed JSON.
 */
export function ItemListJsonLd({ items }: ItemListJsonLdProps) {
  const json = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: item.href,
      name: item.name,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json).replace(/</g, "\\u003c") }}
    />
  );
}
