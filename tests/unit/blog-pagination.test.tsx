import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BlogPagination } from "@/components/storefront/blog/blog-pagination";

describe("BlogPagination", () => {
  it("renders nothing when everything fits on one page", () => {
    const { container } = render(<BlogPagination page={1} pageSize={12} total={5} buildHref={(p) => `/blog?page=${p}`} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders page links with aria-current on the active page, and prev/next where applicable", () => {
    render(<BlogPagination page={2} pageSize={10} total={35} buildHref={(p) => `/blog?page=${p}`} />);
    const page2 = screen.getByRole("link", { name: "2" });
    expect(page2).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /previous/i })).toHaveAttribute("href", "/blog?page=1");
    expect(screen.getByRole("link", { name: /next/i })).toHaveAttribute("href", "/blog?page=3");
  });

  it("omits the previous link on page 1 and the next link on the last page", () => {
    render(<BlogPagination page={1} pageSize={10} total={15} buildHref={(p) => `/blog?page=${p}`} />);
    expect(screen.queryByRole("link", { name: /previous/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /next/i })).toBeInTheDocument();

    // Unmount the page-1 render before rendering page 2 — otherwise both
    // trees stay in the document (RTL's auto-cleanup only runs between
    // tests, not between renders within the same test) and the page-1
    // "Next" link would still satisfy the query below.
    cleanup();
    render(<BlogPagination page={2} pageSize={10} total={15} buildHref={(p) => `/blog?page=${p}`} />);
    expect(screen.queryByRole("link", { name: /next/i })).not.toBeInTheDocument();
  });
});
