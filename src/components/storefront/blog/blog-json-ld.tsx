import { JsonLdScript } from "@/components/storefront/product/json-ld-script";

interface BlogJsonLdProps {
  title: string;
  description: string;
  imageUrl: string | null;
  authorName: string;
  publishedAt: string | null;
}

export function BlogJsonLd({ title, description, imageUrl, authorName, publishedAt }: BlogJsonLdProps) {
  const json = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description,
    ...(imageUrl ? { image: imageUrl } : {}),
    author: { "@type": "Person", name: authorName },
    ...(publishedAt ? { datePublished: publishedAt } : {}),
  };

  return <JsonLdScript data={json} />;
}
