import Image from "next/image";

import { ScrollReveal } from "@/components/motion";
import { cn } from "@/lib/utils";
import type { StoryChapterContent } from "@/lib/story-content";

/** STORY-073. Generic text+image chapter — reused for Land/Tradition/Company/Quality, not 4 bespoke components. */
export function StoryChapter({ eyebrow, title, body, image, align }: StoryChapterContent) {
  return (
    <div className={cn("grid grid-cols-1 items-center gap-8 lg:grid-cols-2", align === "right" && "lg:[&>*:first-child]:order-2")}>
      <ScrollReveal>
        <p className="text-small font-medium tracking-wide text-chilli uppercase">{eyebrow}</p>
        <h2 className="mt-2 text-h2 font-heading text-charcoal">{title}</h2>
        <p className="mt-4 text-body text-charcoal/80">{body}</p>
      </ScrollReveal>
      <ScrollReveal delay={0.1}>
        <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-cream">
          <Image src={image.src} alt={image.alt} fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
        </div>
      </ScrollReveal>
    </div>
  );
}
