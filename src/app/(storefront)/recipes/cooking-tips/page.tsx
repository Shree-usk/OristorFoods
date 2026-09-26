import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/storefront/layout/section";
import { CookingTipCard } from "@/components/storefront/recipes/cooking-tip-card";
import { cn } from "@/lib/utils";
import { listCookingTips, listCookingTipTopics } from "@/services/cooking-tip.service";
import { cookingTipListQuerySchema } from "@/validation/cooking-tip.schema";

export const metadata: Metadata = {
  title: "Cooking Tips",
  description: "Quick cooking tips and techniques from Oristor — knife skills, spice tempering, storage, and more.",
  alternates: { canonical: "/recipes/cooking-tips" },
};

interface CookingTipsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CookingTipsPage({ searchParams }: CookingTipsPageProps) {
  const rawParams = await searchParams;
  const query = cookingTipListQuerySchema.parse({
    topic: typeof rawParams.topic === "string" ? rawParams.topic : undefined,
    page: rawParams.page,
  });
  const [result, topics] = await Promise.all([listCookingTips(query), listCookingTipTopics()]);

  return (
    <Section>
      <h1 className="text-h1 font-heading text-charcoal">Cooking Tips</h1>
      <nav aria-label="Filter by topic" className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/recipes/cooking-tips"
          aria-current={!query.topic ? "page" : undefined}
          className={cn("rounded-full border px-4 py-1.5 text-small", !query.topic ? "border-chilli bg-chilli text-white" : "border-input")}
        >
          All
        </Link>
        {topics.map(({ tag }) => (
          <Link
            key={tag}
            href={`/recipes/cooking-tips?topic=${encodeURIComponent(tag)}`}
            aria-current={query.topic === tag ? "page" : undefined}
            className={cn("rounded-full border px-4 py-1.5 text-small", query.topic === tag ? "border-chilli bg-chilli text-white" : "border-input")}
          >
            {tag}
          </Link>
        ))}
      </nav>
      <h2 id="cooking-tips-results-heading" className="sr-only">
        Cooking tips results
      </h2>
      {result.tips.length === 0 ? (
        <p className="mt-8 text-body text-charcoal/70">No cooking tips match that topic.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {result.tips.map((tip) => (
            <CookingTipCard key={tip.id} tip={tip} />
          ))}
        </div>
      )}
    </Section>
  );
}
