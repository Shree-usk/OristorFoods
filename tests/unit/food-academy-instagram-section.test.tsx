import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FoodAcademyInstagramSection } from "@/components/storefront/food-academy/food-academy-instagram-section";
import type { InstagramPostData } from "@/types/home";

const POSTS: InstagramPostData[] = [
  { id: "1", imageSrc: "/img1.webp", imageAlt: "Post one", href: "https://instagram.com/p/1" },
  { id: "2", imageSrc: "/img2.webp", imageAlt: "Post two", href: "https://instagram.com/p/2" },
];

describe("FoodAcademyInstagramSection", () => {
  it("renders the heading, description, CTA and one link per post", () => {
    render(
      <FoodAcademyInstagramSection
        heading="A Taste of ORISTOR on Instagram"
        description="Discover our latest flavours."
        ctaLabel="Follow @ORISTOR on Instagram"
        ctaHref="https://instagram.com/oristorfoods"
        posts={POSTS}
      />,
    );

    expect(screen.getByRole("heading", { name: "A Taste of ORISTOR on Instagram" })).toBeInTheDocument();
    expect(screen.getByText("Discover our latest flavours.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Follow @ORISTOR on Instagram/ })).toHaveAttribute("href", "https://instagram.com/oristorfoods");
    expect(screen.getByRole("link", { name: "Post one" })).toHaveAttribute("href", "https://instagram.com/p/1");
    expect(screen.getByRole("link", { name: "Post two" })).toHaveAttribute("href", "https://instagram.com/p/2");
  });

  it("omits the CTA when unset", () => {
    render(<FoodAcademyInstagramSection heading="Instagram" description="" ctaLabel="" ctaHref="" posts={POSTS} />);
    expect(screen.queryByRole("link", { name: /Follow/ })).not.toBeInTheDocument();
  });

  it("renders nothing when there are no posts", () => {
    const { container } = render(<FoodAcademyInstagramSection heading="Instagram" description="" ctaLabel="" ctaHref="" posts={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
