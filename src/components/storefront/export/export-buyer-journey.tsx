import { Section } from "@/components/storefront/layout/section";
import { resolveExportIcon } from "@/lib/export-icons";

export interface ExportProcessStepData {
  id: string;
  icon: string;
  title: string;
  description: string;
}

/**
 * "Our Export Process" — a connected icon timeline instead of a plain
 * card grid (per the approved design), fed by admin-managed steps; see
 * export-content.service.ts::getProcessStepsForStorefront. No fallback
 * list here: if an admin removes every step, the section simply doesn't
 * render, same as every other admin-emptyable list on this site.
 */
export function ExportBuyerJourney({ steps }: { steps: ExportProcessStepData[] }) {
  if (steps.length === 0) return null;

  return (
    <Section className="bg-beige">
      <h2 className="text-center text-h2 font-heading text-charcoal">Our Export Process</h2>
      <div className="relative mt-10 flex flex-col gap-8 sm:flex-row sm:gap-0">
        {/* Connecting line — desktop only; the mobile layout stacks steps vertically, where a horizontal line wouldn't make sense. */}
        <div aria-hidden="true" className="absolute top-6 right-[9%] left-[9%] hidden h-px bg-border-soft sm:block" />
        {steps.map((step, index) => {
          const Icon = resolveExportIcon(step.icon);
          return (
            <div key={step.id} className="relative flex flex-1 flex-col items-center px-2 text-center">
              <div className="relative z-10 flex size-12 items-center justify-center rounded-full border-2 border-chilli bg-cream">
                {Icon && <Icon className="size-5 text-chilli" aria-hidden="true" />}
              </div>
              <p className="mt-2.5 text-caption font-semibold tracking-wide text-chilli">{String(index + 1).padStart(2, "0")}</p>
              <p className="mt-0.5 text-small font-semibold text-charcoal">{step.title}</p>
              <p className="mt-1 text-caption text-charcoal/65">{step.description}</p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
