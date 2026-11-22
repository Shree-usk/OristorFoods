import { ArrowRight } from "lucide-react";

import type { ProductDetailPreparationStage } from "@/services/product.service";

interface ProductPreparationStorySectionProps {
  enabled: boolean;
  heading: string | null;
  subtitle: string | null;
  stages: ProductDetailPreparationStage[];
}

export function ProductPreparationStorySection({ enabled, heading, subtitle, stages }: ProductPreparationStorySectionProps) {
  if (!enabled || stages.length === 0) return null;

  return (
    <div>
      <div className="text-center">
        <h2 className="text-h3 font-heading text-chilli">{heading ?? "Crafted with Care. Packed with Flavour."}</h2>
        {subtitle && <p className="mt-2 text-small text-charcoal/70">{subtitle}</p>}
      </div>
      <div className="mt-8 flex flex-col items-stretch gap-6 lg:flex-row lg:items-start">
        {stages.map((stage, index) => (
          <div key={`${stage.stageNumber}-${index}`} className="flex flex-1 items-start gap-4 lg:gap-0">
            <div className="flex-1">
              <div className="overflow-hidden rounded-xl border border-gold/30">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin-typed/Media-Library URL, arbitrary domain */}
                <img src={stage.imageUrl} alt={stage.imageAlt ?? ""} className="aspect-square w-full object-cover" />
              </div>
              <div className="mt-3 flex items-start gap-2">
                <span className="text-small font-heading font-semibold text-chilli">{stage.stageNumber}</span>
                <div>
                  <h3 className="text-small font-semibold text-charcoal">{stage.heading}</h3>
                  {stage.description && <p className="mt-1 text-caption text-charcoal/70">{stage.description}</p>}
                </div>
              </div>
            </div>
            {index < stages.length - 1 && (
              <div className="hidden shrink-0 self-center px-2 lg:flex">
                <ArrowRight className="size-6 text-gold" aria-hidden="true" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
