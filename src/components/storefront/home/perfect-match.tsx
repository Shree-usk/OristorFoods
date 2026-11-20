import { ScrollReveal } from "@/components/motion";
import { PerfectMatchSection } from "@/components/storefront/home/perfect-match-section";
import { Section } from "@/components/storefront/layout/section";
import { getPerfectMatchForStorefront } from "@/services/perfect-match.service";

/**
 * Homepage "The Perfect Match" — placed immediately after Export Solutions
 * (see homepage-sections.tsx and (storefront)/page.tsx). Self-contained,
 * same convention as ExportSolutions: fetches its own data, no props.
 * Renders nothing when an admin hasn't published any product into the
 * rail yet — no fabricated product/pairing fallback, same policy as
 * CustomerReviews.
 */
export async function PerfectMatch() {
  const data = await getPerfectMatchForStorefront();
  if (data.products.length === 0) return null;

  return (
    <Section className="bg-cream">
      <ScrollReveal className="mx-auto max-w-2xl text-center">
        {data.eyebrow && <p className="text-caption font-semibold tracking-wide text-chilli uppercase">{data.eyebrow}</p>}
        {data.heading && <h2 className="mt-3 text-h2 font-heading text-charcoal md:text-h1">{data.heading}</h2>}
        {data.description && <p className="mt-4 text-small text-charcoal/75 md:text-body">{data.description}</p>}
      </ScrollReveal>

      <PerfectMatchSection products={data.products} />
    </Section>
  );
}
