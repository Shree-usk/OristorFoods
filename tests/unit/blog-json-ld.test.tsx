import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BlogJsonLd } from "@/components/storefront/blog/blog-json-ld";

describe("BlogJsonLd", () => {
  it("renders a BlogPosting script tag with the expected fields", () => {
    const { container } = render(
      <BlogJsonLd
        title="Spice Basics"
        description="Learn the essentials."
        imageUrl="/img.webp"
        authorName="Amara Perera"
        publishedAt="2026-09-01T00:00:00.000Z"
      />,
    );
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    const json = JSON.parse(script!.textContent!);
    expect(json).toMatchObject({
      "@type": "BlogPosting",
      headline: "Spice Basics",
      author: { "@type": "Person", name: "Amara Perera" },
      datePublished: "2026-09-01T00:00:00.000Z",
    });
  });
});
