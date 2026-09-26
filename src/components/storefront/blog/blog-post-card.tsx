import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { BlogPostCardData } from "@/types/blog";

export function BlogPostCard({ post }: { post: BlogPostCardData }) {
  return (
    <article className="group relative flex h-full flex-col">
      <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-cream">
        {post.heroImageUrl && (
          <Image src={post.heroImageUrl} alt="" fill sizes="(min-width: 1280px) 25vw, (min-width: 640px) 45vw, 90vw" className="object-cover" />
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {post.tags.map((tag) => (
          <Badge key={tag.slug} variant="outline">
            {tag.name}
          </Badge>
        ))}
      </div>
      <h3 className="mt-1 text-h4 font-heading text-charcoal">
        <Link href={post.href} className="after:absolute after:inset-0 hover:underline">
          {post.title}
        </Link>
      </h3>
      <p className="mt-2 text-small text-charcoal/80">{post.excerpt}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-caption text-charcoal/70">
        <span>{post.authorName}</span>
        {post.readingTimeMinutes !== null && <span>{post.readingTimeMinutes} min read</span>}
      </div>
    </article>
  );
}
