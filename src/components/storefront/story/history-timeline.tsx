import Image from "next/image";

import { ScrollReveal } from "@/components/motion";
import type { MilestoneContent } from "@/types/story";

interface HistoryTimelineProps {
  milestones: MilestoneContent[];
}

/** Chronological founding-story timeline — admin-editable via Story Pages, repeatable so the real history can grow one real milestone at a time rather than being locked to a fixed count like the 4 narrative Chapters. */
export function HistoryTimeline({ milestones }: HistoryTimelineProps) {
  if (milestones.length === 0) return null;

  return (
    <div>
      <ScrollReveal>
        <p className="text-center text-small font-medium tracking-wide text-chilli uppercase">Our Heritage</p>
        <h2 className="mt-2 text-center text-h2 font-heading text-charcoal">How We Got Here</h2>
      </ScrollReveal>

      <div className="mx-auto mt-10 max-w-2xl space-y-10">
        {milestones.map((milestone, index) => (
          <ScrollReveal key={milestone.id} delay={index * 0.06}>
            <div className="flex gap-5">
              <div className="flex-none">
                {milestone.year ? (
                  <span className="inline-block min-w-[4.5rem] text-h5 font-heading text-gold">{milestone.year}</span>
                ) : (
                  <span className="inline-block size-2 translate-y-2 rounded-full bg-gold" />
                )}
              </div>
              <div className="flex-1 border-l border-border pb-2 pl-5">
                <h3 className="text-h4 font-heading text-charcoal">{milestone.title}</h3>
                <p className="mt-2 text-small text-charcoal/80">{milestone.body}</p>
                {milestone.image && (
                  <div className="relative mt-4 aspect-video overflow-hidden rounded-lg bg-cream">
                    <Image src={milestone.image.src} alt={milestone.image.alt} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
                  </div>
                )}
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </div>
  );
}
