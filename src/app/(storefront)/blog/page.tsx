import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/storefront/layout/section";
import { BlogPostCard } from "@/components/storefront/blog/blog-post-card";
import { BlogPagination } from "@/components/storefront/blog/blog-pagination";
import { ItemListJsonLd } from "@/components/storefront/product/item-list-json-ld";
import { buildBlogChipHref } from "@/lib/blog-chip-href";
import { cn } from "@/lib/utils";
import { listAuthors, listPosts, listTags } from "@/services/blog.service";
import { blogListQuerySchema } from "@/validation/blog.schema";

export const metadata: Metadata = {
  title: "Blog",
  description: "Sri Lankan food stories, techniques and brand news from Oristor.",
  alternates: { canonical: "/blog" },
};

interface BlogPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const rawParams = await searchParams;
  const query = blogListQuerySchema.parse({
    tag: typeof rawParams.tag === "string" ? rawParams.tag : undefined,
    author: typeof rawParams.author === "string" ? rawParams.author : undefined,
    page: rawParams.page,
  });
  const [result, tags, authors] = await Promise.all([listPosts(query), listTags(), listAuthors()]);

  function chipHref(overrides: { tag?: string; author?: string }) {
    return buildBlogChipHref(query, overrides);
  }

  function pageHref(page: number) {
    const params = new URLSearchParams();
    if (query.tag) params.set("tag", query.tag);
    if (query.author) params.set("author", query.author);
    params.set("page", String(page));
    return `/blog?${params.toString()}`;
  }

  return (
    <Section>
      <h1 className="text-h1 font-heading text-charcoal">Blog</h1>

      <nav aria-label="Filter by tag" className="mt-8 flex flex-wrap gap-2">
        <Link
          href={chipHref({ tag: undefined })}
          aria-current={!query.tag ? "page" : undefined}
          className={cn("rounded-full border px-4 py-1.5 text-small", !query.tag ? "border-chilli bg-chilli text-white" : "border-input")}
        >
          All tags
        </Link>
        {tags.map((tag) => (
          <Link
            key={tag.slug}
            href={chipHref({ tag: tag.slug })}
            aria-current={query.tag === tag.slug ? "page" : undefined}
            className={cn("rounded-full border px-4 py-1.5 text-small", query.tag === tag.slug ? "border-chilli bg-chilli text-white" : "border-input")}
          >
            {tag.name}
          </Link>
        ))}
      </nav>
      <nav aria-label="Filter by author" className="mt-2 flex flex-wrap gap-2">
        <Link
          href={chipHref({ author: undefined })}
          aria-current={!query.author ? "page" : undefined}
          className={cn("rounded-full border px-4 py-1.5 text-small", !query.author ? "border-chilli bg-chilli text-white" : "border-input")}
        >
          All authors
        </Link>
        {authors.map((author) => (
          <Link
            key={author.slug}
            href={chipHref({ author: author.slug })}
            aria-current={query.author === author.slug ? "page" : undefined}
            className={cn("rounded-full border px-4 py-1.5 text-small", query.author === author.slug ? "border-chilli bg-chilli text-white" : "border-input")}
          >
            {author.name}
          </Link>
        ))}
      </nav>

      <h2 id="blog-results-heading" className="sr-only">
        Blog results
      </h2>
      <p className="mt-6 text-small text-charcoal/70">{result.total} post{result.total === 1 ? "" : "s"}</p>

      {result.posts.length === 0 ? (
        <p className="mt-4 text-body text-charcoal/70">No posts match that filter.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {result.posts.map((post) => (
            <BlogPostCard key={post.id} post={post} />
          ))}
        </div>
      )}
      <BlogPagination page={result.page} pageSize={result.pageSize} total={result.total} buildHref={pageHref} />
      <ItemListJsonLd items={result.posts.map((post) => ({ href: post.href, name: post.title }))} />
    </Section>
  );
}
