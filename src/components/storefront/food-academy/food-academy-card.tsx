import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { FoodAcademyEntryCard as FoodAcademyEntryCardData } from "@/types/food-academy";

export function FoodAcademyCard({ entry }: { entry: FoodAcademyEntryCardData }) {
  return (
    <article className="group relative flex h-full flex-col">
      <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-cream">
        {entry.heroImageUrl && (
          <Image
            src={entry.heroImageUrl}
            alt=""
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 640px) 45vw, 90vw"
            className="object-cover"
          />
        )}
        <Badge className="absolute top-2 left-2">{entry.contentType}</Badge>
      </div>
      <p className="mt-3 text-caption font-medium text-chilli">{entry.categoryName}</p>
      <h3 className="mt-1 text-h4 font-heading text-charcoal">
        <Link href={entry.href} className="after:absolute after:inset-0 hover:underline">
          {entry.title}
        </Link>
      </h3>
      <p className="mt-2 text-small text-charcoal/80">{entry.summary}</p>
      {entry.readingTimeMinutes !== null && (
        <p className="mt-2 text-caption text-charcoal/70">{entry.readingTimeMinutes} min read</p>
      )}
    </article>
  );
}
