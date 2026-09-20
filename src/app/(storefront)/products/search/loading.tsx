// src/app/(storefront)/products/search/loading.tsx
import { Section } from "@/components/storefront/layout/section";

export default function ProductSearchLoading() {
  return (
    <Section>
      <div className="h-9 w-64 animate-pulse rounded bg-cream" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="aspect-square animate-pulse rounded-lg bg-cream" />
        ))}
      </div>
    </Section>
  );
}
