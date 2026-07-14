import Image from "next/image";

import { ScrollReveal } from "@/components/motion";
import { Section } from "@/components/storefront/layout/section";
import type { InstagramPostData } from "@/types/home";

export function InstagramGallery({ posts }: { posts: InstagramPostData[] }) {
  return (
    <Section>
      <div className="text-center">
        <h2 className="text-h2 font-heading text-charcoal">Follow @oristorfoods</h2>
        <p className="mt-2 text-body text-charcoal/80">Tag us in your Oristor creations for a chance to be featured.</p>
      </div>
      <div className="mt-8 grid grid-cols-3 gap-2 sm:gap-4 lg:grid-cols-6">
        {posts.map((post, index) => (
          <ScrollReveal key={post.id} delay={index * 0.04}>
            <a
              href={post.href}
              target="_blank"
              rel="noopener noreferrer"
              className="relative block aspect-square overflow-hidden rounded-lg bg-beige"
            >
              <Image
                src={post.imageSrc}
                alt={post.imageAlt}
                fill
                sizes="(min-width: 1024px) 16vw, 30vw"
                className="object-contain p-2 transition-transform duration-300 hover:scale-105"
              />
            </a>
          </ScrollReveal>
        ))}
      </div>
    </Section>
  );
}
