import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Breadcrumbs } from "@/components/storefront/layout/breadcrumbs";
import { Section } from "@/components/storefront/layout/section";
import { BlogJsonLd } from "@/components/storefront/blog/blog-json-ld";
import { BlogPostBody } from "@/components/storefront/blog/blog-post-body";
import { BlogPostCard } from "@/components/storefront/blog/blog-post-card";
import { CommentSection } from "@/components/storefront/blog/comment-section";
import { parseBodyBlocks } from "@/lib/blog-body-blocks";
import { getPostBySlug } from "@/services/blog.service";

const getCachedPost = cache(getPostBySlug);

interface BlogDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BlogDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await getCachedPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: `/blog/${slug}` },
  };
}

export default async function BlogDetailPage({ params }: BlogDetailPageProps) {
  const { slug } = await params;
  const post = await getCachedPost(slug);
  if (!post) notFound();

  const blocks = parseBodyBlocks(post.bodyContent);

  return (
    <Section>
      <Breadcrumbs items={[{ name: "Blog", href: "/blog" }, { name: post.title, href: post.href }]} />
      <BlogJsonLd title={post.title} description={post.excerpt} imageUrl={post.heroImageUrl} authorName={post.authorName} publishedAt={post.publishedAt} />

      <h1 className="mt-4 text-h1 font-heading text-charcoal">{post.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-caption text-charcoal/70">
        <span>By {post.authorName}</span>
        {post.readingTimeMinutes !== null && <span>{post.readingTimeMinutes} min read</span>}
      </div>

      {post.heroImageUrl && (
        <div className="relative mt-6 aspect-video w-full overflow-hidden rounded-lg bg-cream">
          <Image src={post.heroImageUrl} alt="" fill className="object-cover" priority sizes="100vw" />
        </div>
      )}

      <div className="mt-6">
        <BlogPostBody blocks={blocks} recipeCards={post.recipeCards} videoPosterUrl={post.heroImageUrl} videoPosterAlt="" />
      </div>

      {post.authorBio && (
        <div className="mt-8 flex items-start gap-4 rounded-lg border border-input p-4">
          {post.authorAvatarUrl && (
            <div className="relative size-12 shrink-0 overflow-hidden rounded-full bg-cream">
              <Image src={post.authorAvatarUrl} alt="" fill className="object-cover" />
            </div>
          )}
          <div>
            <a href={`/blog?author=${encodeURIComponent(post.authorSlug)}`} className="text-small font-medium text-charcoal hover:underline">
              {post.authorName}
            </a>
            <p className="mt-1 text-small text-charcoal/70">{post.authorBio}</p>
          </div>
        </div>
      )}

      {post.relatedPosts.length > 0 && (
        <div className="mt-10">
          <h2 className="text-h3 font-heading text-charcoal">Related posts</h2>
          <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-3">
            {post.relatedPosts.map((related) => (
              <BlogPostCard key={related.id} post={related} />
            ))}
          </div>
        </div>
      )}

      <CommentSection postSlug={post.slug} comments={post.comments} />
    </Section>
  );
}
