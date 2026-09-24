import { Section } from "@/components/storefront/layout/section";

export default function RecipesLoading() {
  return (
    <Section aria-busy="true">
      <h1 className="text-h1 font-heading text-charcoal">Recipe Centre</h1>
      <p className="sr-only">Loading recipes…</p>
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex flex-col gap-3">
            <div className="aspect-4/3 animate-pulse rounded-lg bg-muted" />
            <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </Section>
  );
}
