import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BlogCommentList } from "@/components/storefront/blog/blog-comment-list";

describe("BlogCommentList", () => {
  it("renders each comment's author and body", () => {
    render(
      <BlogCommentList
        comments={[
          { id: "1", authorName: "Nadeesha", body: "Loved this recipe.", createdAt: "2026-09-01T00:00:00.000Z" },
          { id: "2", authorName: "Kamal", body: "Very helpful, thanks!", createdAt: "2026-09-02T00:00:00.000Z" },
        ]}
      />,
    );
    expect(screen.getByText("Nadeesha")).toBeInTheDocument();
    expect(screen.getByText("Loved this recipe.")).toBeInTheDocument();
    expect(screen.getByText("Kamal")).toBeInTheDocument();
  });

  it("shows a 'no comments yet' message when the list is empty", () => {
    render(<BlogCommentList comments={[]} />);
    expect(screen.getByText(/no comments yet/i)).toBeInTheDocument();
  });
});
