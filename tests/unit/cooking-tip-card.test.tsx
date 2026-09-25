import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CookingTipCard } from "@/components/storefront/recipes/cooking-tip-card";

describe("CookingTipCard", () => {
  it("links to the tip's detail page and shows a video badge when applicable", () => {
    render(
      <CookingTipCard
        tip={{ id: "1", slug: "knife-basics", href: "/recipes/cooking-tips/knife-basics", title: "Knife Basics", summary: "Learn the grip.", imageUrl: "/img.webp", hasVideo: true, topicTag: "knife-skills" }}
      />,
    );
    expect(screen.getByRole("link", { name: /knife basics/i })).toHaveAttribute("href", "/recipes/cooking-tips/knife-basics");
    expect(screen.getByLabelText(/video available/i)).toBeInTheDocument();
  });

  it("omits the video badge when there is no video", () => {
    render(
      <CookingTipCard
        tip={{ id: "2", slug: "storage", href: "/recipes/cooking-tips/storage", title: "Storage", summary: "Keep it fresh.", imageUrl: null, hasVideo: false, topicTag: "storage" }}
      />,
    );
    expect(screen.queryByLabelText(/video available/i)).not.toBeInTheDocument();
  });
});
