import { ScrollReveal } from "@/components/motion";
import { Section } from "@/components/storefront/layout/section";
import type { WhyChooseFeatureData } from "@/types/home";

export function WhyChooseOristor({ features }: { features: WhyChooseFeatureData[] }) {
  return (
    <Section className="bg-beige">
      <h2 className="text-h2 font-heading text-charcoal">Why Choose Oristor</h2>
      <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((feature, index) => (
          <ScrollReveal key={feature.id} delay={index * 0.05}>
            <div className="flex items-start gap-4 sm:flex-col sm:items-start sm:gap-3">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold">
                <feature.icon className="size-6" aria-hidden="true" />
              </div>
              <div>
                <p className="text-h4 font-heading text-charcoal">{feature.title}</p>
                {/* text-charcoal, not text-stone: Stone Grey on this
                    section's Beige background is 3.2:1 — fails WCAG AA's
                    4.5:1 for normal text (see docs/architecture-decisions.md,
                    the same finding STORY-004 hit on the mobile nav). */}
                <p className="mt-1 text-small text-charcoal/80">{feature.description}</p>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </Section>
  );
}
