import { ScrollReveal } from "@/components/motion";
import { oristorValues } from "@/lib/story-content";

/** STORY-073. Chapter 05 — the seven O-R-I-S-T-O-R values, progressively revealed, not a static seven-column block. */
export function ValueReveal() {
  return (
    <div>
      <ScrollReveal>
        <p className="text-center text-small font-medium tracking-wide text-chilli uppercase">Chapter 05</p>
        <h2 className="mt-2 text-center text-h2 font-heading text-charcoal">What We Stand For</h2>
      </ScrollReveal>

      <div className="mt-8 space-y-6">
        {oristorValues.map((value, index) => (
          <ScrollReveal key={`${value.letter}-${value.word}`} delay={index * 0.06}>
            <div className="flex items-baseline gap-4 border-b border-border pb-4">
              <span className="text-hero font-heading text-gold">{value.letter}</span>
              <div>
                <h3 className="text-h5 font-heading text-charcoal uppercase">{value.word}</h3>
                <p className="mt-1 text-small text-charcoal/80">{value.description}</p>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </div>
  );
}
