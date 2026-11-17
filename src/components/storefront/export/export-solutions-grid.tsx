import { ScrollReveal } from "@/components/motion";
import { Section } from "@/components/storefront/layout/section";
import { resolveExportIcon } from "@/lib/export-icons";

export interface ExportSolutionCardData {
  id: string;
  icon: string;
  title: string;
  description: string;
}

/**
 * Admin-managed "Export Solutions" cards shown right after the
 * certification strip — see export-content.service.ts::getSolutionCardsForStorefront.
 * Named *Grid, not *Solutions, to avoid colliding with the unrelated
 * homepage component of the same short name
 * (src/components/storefront/home/export-solutions.tsx).
 */
export function ExportSolutionsGrid({ cards }: { cards: ExportSolutionCardData[] }) {
  if (cards.length === 0) return null;

  return (
    <Section>
      <h2 className="text-center text-h2 font-heading text-charcoal">Export Solutions</h2>
      <div className="mx-auto mt-8 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3">
        {cards.map((card, index) => {
          const Icon = resolveExportIcon(card.icon);
          return (
            <ScrollReveal key={card.id} delay={index * 0.05}>
              <div className="rounded-lg border border-border-soft bg-cream p-7 text-center">
                <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-chilli/10">
                  {Icon && <Icon className="size-6 text-chilli" aria-hidden="true" />}
                </div>
                <p className="mt-4 text-h4 font-heading text-charcoal">{card.title}</p>
                <p className="mt-2 text-small text-charcoal/70">{card.description}</p>
              </div>
            </ScrollReveal>
          );
        })}
      </div>
    </Section>
  );
}
