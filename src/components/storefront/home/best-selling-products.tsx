import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Star } from "lucide-react";

import { ScrollReveal } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/storefront/layout/section";
import { auth } from "@/lib/auth";
import { getSessionId } from "@/lib/recommendation-session";
import { resolveCustomerGroupForUser } from "@/services/pricing.service";
import { getHomepageRecommendations } from "@/services/recommendation.service";

function formatPrice(price: number, currency: string) {
  return `${currency} ${price.toLocaleString()}`;
}

const LIMIT = 10;

/**
 * STORY-060. Upgraded from STORY-042's typed-fixture placeholder to
 * real data — same async-Server-Component-fetches-its-own-data
 * pattern FeaturedRecipes already established, so both homepage call
 * sites (the fallback path and HomepageSections' Builder path) get
 * personalization for free with no prop-threading change at either.
 * `titleOverride` still wins when an admin set one; otherwise the
 * title reflects whichever strategy actually ran.
 */
export async function BestSellingProducts({ titleOverride }: { titleOverride?: string | null } = {}) {
  await connection();
  const session = await auth();
  const customerId = session?.user?.id ?? null;
  const customerGroup = await resolveCustomerGroupForUser(customerId);
  const sessionId = customerId ? null : await getSessionId();

  const { products, personalized } = await getHomepageRecommendations({ customerId, sessionId, customerGroup, limit: LIMIT });
  if (products.length === 0) return null;

  const heading = titleOverride || (personalized ? "Recommended for You" : "Best Selling Products");

  return (
    <Section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-h2 font-heading text-charcoal">{heading}</h2>
        <Link href="/products?collection=best-sellers" className="text-small text-chilli hover:underline">
          View all
        </Link>
      </div>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {products.map((product, index) => (
          <ScrollReveal key={product.id} delay={index * 0.05}>
            <Link href={product.href} className="group block">
              <div className="relative aspect-square overflow-hidden rounded-lg bg-cream">
                {product.badge && (
                  <Badge className="absolute top-2 left-2 z-10">{product.badge}</Badge>
                )}
                <Image
                  src={product.imageSrc}
                  alt={product.imageAlt}
                  fill
                  sizes="(min-width: 1024px) 20vw, (min-width: 640px) 30vw, 45vw"
                  className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <p className="mt-3 text-small font-medium text-charcoal">{product.name}</p>
              {product.rating && (
                <div className="mt-1 flex items-center gap-1 text-caption text-charcoal/80">
                  <Star className="size-3.5 fill-gold text-gold" aria-hidden="true" />
                  <span>{product.rating}</span>
                  {product.reviewCount && <span>({product.reviewCount})</span>}
                </div>
              )}
              <p className="mt-1 font-number text-body text-charcoal">
                {formatPrice(product.price, product.currency)}
              </p>
            </Link>
          </ScrollReveal>
        ))}
      </div>
    </Section>
  );
}
