import { JsonLdScript } from "@/components/storefront/product/json-ld-script";

interface ItemListJsonLdProps {
  items: Array<{ href: string; name: string }>;
}

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

  return <JsonLdScript data={json} />;
}
