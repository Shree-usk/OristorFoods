import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import type { CookingTipCard as CookingTipCardData } from "@/types/cooking-tip";

export function CookingTipCard({ tip }: { tip: CookingTipCardData }) {
  return (
    <article className="group relative flex h-full flex-col">
      <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-cream">
        {tip.imageUrl && (
          <Image src={tip.imageUrl} alt="" fill sizes="(min-width: 1280px) 25vw, (min-width: 640px) 45vw, 90vw" className="object-contain p-6" />
        )}
        {tip.hasVideo && (
          <span aria-label="Video available" className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white">
            <Play className="size-3.5 fill-current" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-3 text-caption font-medium text-chilli">{tip.topicTag}</p>
      <h3 className="mt-1 text-h4 font-heading text-charcoal">
        <Link href={tip.href} className="after:absolute after:inset-0 hover:underline">
          {tip.title}
        </Link>
      </h3>
      <p className="mt-2 text-small text-charcoal/80">{tip.summary}</p>
    </article>
  );
}
