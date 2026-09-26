import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FoodAcademyCard } from "@/components/storefront/food-academy/food-academy-card";

describe("FoodAcademyCard", () => {
  it("links to the entry's detail page and shows the contentType badge", () => {
    render(
      <FoodAcademyCard
        entry={{ id: "1", slug: "knife-basics", href: "/food-academy/knife-basics", title: "Knife Basics", summary: "Learn the grip.", heroImageUrl: "/img.webp", contentType: "Guide", categoryName: "Techniques", categorySlug: "techniques", readingTimeMinutes: 5, isFeatured: false }}
      />,
    );
    expect(screen.getByRole("link", { name: /knife basics/i })).toHaveAttribute("href", "/food-academy/knife-basics");
    expect(screen.getByText("Guide")).toBeInTheDocument();
    expect(screen.getByText(/5 min/i)).toBeInTheDocument();
  });

  it("omits the reading time when null", () => {
    render(
      <FoodAcademyCard
        entry={{ id: "2", slug: "no-time", href: "/food-academy/no-time", title: "No Time", summary: "...", heroImageUrl: null, contentType: "Article", categoryName: "Culture", categorySlug: "culture", readingTimeMinutes: null, isFeatured: false }}
      />,
    );
    expect(screen.queryByText(/min/i)).not.toBeInTheDocument();
  });
});
