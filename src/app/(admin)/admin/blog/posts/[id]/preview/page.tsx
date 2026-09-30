import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { BlogPostBody } from "@/components/storefront/blog/blog-post-body";
import { adminAuth } from "@/lib/admin-auth";
import { hasPermission } from "@/services/permission.service";
import { BlogPostNotFoundError } from "@/services/blog-admin.errors";
import { getPostForPreview } from "@/services/blog-admin.service";

export const metadata: Metadata = {
  title: "Preview | Blog Post | Admin",
  robots: { index: false, follow: false },
};

/** STORY-044. Admin-only, any-status preview via getPostForPreview — renders through the real storefront BlogPostBody component so it can never structurally drift from /blog/[slug]. */
export default async function AdminBlogPostPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");
  if (!(await hasPermission(session.user.id, "Blog", "View"))) redirect("/admin");

  const { id } = await params;
  let post;
  try {
    post = await getPostForPreview(session.user.id, id);
  } catch (error) {
    if (error instanceof BlogPostNotFoundError) notFound();
    throw error;
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-input pb-4">
        <p className="text-small text-charcoal/70">Previewing post — not the live storefront.</p>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/admin/blog/posts/${id}`} />}>
          Back to editor
        </Button>
      </div>

      <div className="mx-auto mt-8 max-w-2xl">
        <h1 className="text-h1 font-heading text-charcoal">{post.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-caption text-charcoal/70">
          <span>By {post.authorName}</span>
          {post.readingTimeMinutes !== null && <span>{post.readingTimeMinutes} min read</span>}
        </div>

        {post.heroImageUrl && (
          <div className="relative mt-6 aspect-video w-full overflow-hidden rounded-lg bg-cream">
            <Image src={post.heroImageUrl} alt="" fill className="object-cover" sizes="100vw" />
          </div>
        )}

        <div className="mt-6">
          <BlogPostBody blocks={post.blocks} recipeCards={post.recipeCards} videoPosterUrl={post.heroImageUrl} videoPosterAlt="" />
        </div>

        {post.authorBio && (
          <div className="mt-8 flex items-start gap-4 rounded-lg border border-input p-4">
            {post.authorAvatarUrl && (
              <div className="relative size-12 shrink-0 overflow-hidden rounded-full bg-cream">
                <Image src={post.authorAvatarUrl} alt="" fill className="object-cover" />
              </div>
            )}
            <div>
              <p className="text-small font-medium text-charcoal">{post.authorName}</p>
              <p className="mt-1 text-small text-charcoal/70">{post.authorBio}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
