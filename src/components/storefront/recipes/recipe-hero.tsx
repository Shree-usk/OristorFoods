import Image from "next/image";

interface RecipeHeroProps {
  heroImage: string;
  heroImageAlt: string;
  galleryImageUrls: string[];
}

export function RecipeHero({ heroImage, heroImageAlt, galleryImageUrls }: RecipeHeroProps) {
  return (
    <div>
      <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-cream sm:aspect-16/9">
        <Image src={heroImage} alt={heroImageAlt} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
      </div>
      {galleryImageUrls.length > 0 && (
        <div className="mt-3 flex gap-2 print:hidden">
          {galleryImageUrls.map((url) => (
            <div key={url} className="relative size-16 overflow-hidden rounded-md bg-cream">
              <Image src={url} alt="" fill className="object-cover" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
