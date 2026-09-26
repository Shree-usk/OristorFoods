import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BlogPostCard } from "@/components/storefront/blog/blog-post-card";
import type { BlogPostCardData } from "@/types/blog";

const post: BlogPostCardData = {
  id: "1",
  slug: "spice-basics",
  href: "/blog/spice-basics",
  title: "Spice Basics",
  excerpt: "Learn the essentials.",
  heroImageUrl: "/img.webp",
  authorName: "Amara Perera",
  authorSlug: "amara-perera",
  publishedAt: "2026-09-01T00:00:00.000Z",
  readingTimeMinutes: 6,
  tags: [{ name: "Spices", slug: "spices" }],
};

describe("BlogPostCard", () => {
  it("links to the post's detail page and shows author and reading time", () => {
    render(<BlogPostCard post={post} />);
    expect(screen.getByRole("link", { name: /spice basics/i })).toHaveAttribute("href", "/blog/spice-basics");
    expect(screen.getByText(/amara perera/i)).toBeInTheDocument();
    expect(screen.getByText(/6 min/i)).toBeInTheDocument();
  });

  it("omits reading time when null", () => {
    render(<BlogPostCard post={{ ...post, readingTimeMinutes: null }} />);
    expect(screen.queryByText(/min/i)).not.toBeInTheDocument();
  });
});
