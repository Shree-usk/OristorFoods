import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { BlogPostBody } from "@/components/storefront/blog/blog-post-body";
import { parseBodyBlocks } from "@/lib/blog-body-blocks";
import type { RecipeCard as RecipeCardData } from "@/types/recipe";

const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({ useSession: () => mockUseSession() }));

beforeEach(() => {
  mockUseSession.mockReturnValue({ status: "unauthenticated" });
});

function renderBody(ui: ReactElement) {
  const queryClient = new QueryClient();
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

const sampleRecipe: RecipeCardData = {
  id: "r1",
  slug: "sri-lankan-chicken-curry",
  href: "/recipes/sri-lankan-chicken-curry",
  title: "Sri Lankan Chicken Curry",
  heroImage: "/curry.webp",
  heroImageAlt: "Chicken curry",
  categoryName: "Curries",
  cuisine: "Sri Lankan",
  difficulty: "Medium",
  totalTimeMinutes: 45,
  avgRating: null,
  ratingCount: 0,
  dietaryTags: [],
  hasVideo: false,
};

describe("BlogPostBody", () => {
  it("renders markdown blocks and a resolved recipe embed as a real RecipeCard", () => {
    const blocks = parseBodyBlocks("Intro.\n\n[[recipe:sri-lankan-chicken-curry]]\n\nOutro.");
    renderBody(
      <BlogPostBody
        blocks={blocks}
        recipeCards={{ "sri-lankan-chicken-curry": sampleRecipe }}
        videoPosterUrl={null}
        videoPosterAlt=""
      />,
    );
    expect(screen.getByText("Intro.")).toBeInTheDocument();
    expect(screen.getByText("Outro.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sri lankan chicken curry/i })).toHaveAttribute(
      "href",
      "/recipes/sri-lankan-chicken-curry",
    );
  });

  it("silently omits a recipe embed with no matching resolved card", () => {
    const blocks = parseBodyBlocks("Before.\n\n[[recipe:does-not-exist]]\n\nAfter.");
    const { container } = renderBody(<BlogPostBody blocks={blocks} recipeCards={{}} videoPosterUrl={null} videoPosterAlt="" />);
    expect(screen.getByText("Before.")).toBeInTheDocument();
    expect(screen.getByText("After.")).toBeInTheDocument();
    expect(container.textContent).not.toContain("[[recipe:");
  });

  it("renders a resolvable video embed URL as a real video player", () => {
    const blocks = parseBodyBlocks("Watch:\n\n[[video:https://www.youtube.com/watch?v=abc12345678]]");
    renderBody(<BlogPostBody blocks={blocks} recipeCards={{}} videoPosterUrl="/poster.jpg" videoPosterAlt="Post hero" />);
    expect(screen.getByText("Watch:")).toBeInTheDocument();
    // VideoPlayer renders a poster <img> with a play button before being clicked.
    expect(screen.getByRole("button", { name: /play/i })).toBeInTheDocument();
  });

  it("silently omits a video embed when there is no poster image to fall back to", () => {
    const blocks = parseBodyBlocks("[[video:https://www.youtube.com/watch?v=abc12345678]]");
    const { container } = renderBody(<BlogPostBody blocks={blocks} recipeCards={{}} videoPosterUrl={null} videoPosterAlt="" />);
    expect(container.textContent).not.toContain("[[video:");
    expect(screen.queryByRole("button", { name: /play/i })).not.toBeInTheDocument();
  });
});
