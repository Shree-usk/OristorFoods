import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Section } from "@/components/storefront/layout/section";
import { CookingTipCard } from "@/components/storefront/recipes/cooking-tip-card";
import { VideoPlayer } from "@/components/storefront/recipes/video-player";
import { getCookingTipBySlug } from "@/services/cooking-tip.service";

const getCachedTip = cache(getCookingTipBySlug);

interface CookingTipDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CookingTipDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tip = await getCachedTip(slug);
  if (!tip) return {};
  return { title: tip.title, description: tip.summary, alternates: { canonical: `/recipes/cooking-tips/${slug}` } };
}

export default async function CookingTipDetailPage({ params }: CookingTipDetailPageProps) {
  const { slug } = await params;
  const tip = await getCachedTip(slug);
  if (!tip) notFound();

  return (
    <Section>
      <h1 className="text-h1 font-heading text-charcoal">{tip.title}</h1>
      <p className="mt-2 text-body text-charcoal/80">{tip.summary}</p>

      <div className="mt-6 max-w-2xl">
        {tip.video ? (
          <VideoPlayer video={tip.video} posterUrl={tip.imageUrl ?? "/images/products/export/curry-powder.webp"} posterAlt={tip.title} />
        ) : (
          tip.imageUrl && (
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-cream">
              <Image src={tip.imageUrl} alt="" fill className="object-cover" />
            </div>
          )
        )}
      </div>

      <div className="mt-6 max-w-2xl whitespace-pre-line text-body text-charcoal">{tip.bodyContent}</div>

      {tip.products.length > 0 && (
        <div className="mt-8">
          <h2 className="text-h4 font-heading text-charcoal">Products used</h2>
          <ul className="mt-2 flex flex-wrap gap-3">
            {tip.products.map((product) => (
              <li key={product.id}>
                <Link href={`/products/${product.slug}`} className="text-chilli underline-offset-2 hover:underline">
                  {product.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tip.relatedTips.length > 0 && (
        <div className="mt-10">
          <h2 className="text-h3 font-heading text-charcoal">Related tips</h2>
          <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-3">
            {tip.relatedTips.map((related) => (
              <CookingTipCard key={related.id} tip={related} />
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}
