import { ScrollReveal } from "@/components/motion";
import { Section } from "@/components/storefront/layout/section";
import type { WhyChooseFeatureData } from "@/types/home";

/**
 * Homepage/Header redesign: a full-width horizontal strip immediately
 * below the hero (no heading of its own, unlike the old in-page section
 * it replaces — see docs for the Spice House reference this follows).
 * Content is admin-editable per item (icon/title/description) via the
 * Homepage Builder's WhyChooseOristor editor; `features` already carries
 * either those real rows or the original 4 approved benefits as a
 * fallback — this component doesn't know or care which.
 */
export function WhyChooseOristor({ features }: { features: WhyChooseFeatureData[] }) {
  return (
    <Section className="bg-leaf-dark" spacing="sm">
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4 lg:gap-8">
        {features.map((feature, index) => (
          <ScrollReveal key={feature.id} delay={index * 0.05}>
            <div className="flex items-start gap-3">
              <feature.icon className="size-7 shrink-0 text-cream" aria-hidden="true" />
              <div>
                <p className="text-small font-heading font-semibold text-cream sm:text-body">{feature.title}</p>
                <p className="mt-1 text-caption text-cream/80 sm:text-small">{feature.description}</p>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </Section>
  );
}
