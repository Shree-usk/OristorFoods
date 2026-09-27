import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DownloadPagination } from "@/components/storefront/downloads/download-pagination";

describe("DownloadPagination", () => {
  it("renders nothing when everything fits on one page", () => {
    const { container } = render(<DownloadPagination page={1} pageSize={24} total={3} buildHref={(p) => `/downloads?page=${p}`} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders page links with aria-current on the active page, and prev/next where applicable", () => {
    render(<DownloadPagination page={2} pageSize={10} total={35} buildHref={(p) => `/downloads?page=${p}`} />);
    const page2 = screen.getByRole("link", { name: "2" });
    expect(page2).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /previous/i })).toHaveAttribute("href", "/downloads?page=1");
    expect(screen.getByRole("link", { name: /next/i })).toHaveAttribute("href", "/downloads?page=3");
  });

  it("omits the previous link on page 1 and the next link on the last page", () => {
    render(<DownloadPagination page={1} pageSize={10} total={15} buildHref={(p) => `/downloads?page=${p}`} />);
    expect(screen.queryByRole("link", { name: /previous/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /next/i })).toBeInTheDocument();

    cleanup();
    render(<DownloadPagination page={2} pageSize={10} total={15} buildHref={(p) => `/downloads?page=${p}`} />);
    expect(screen.queryByRole("link", { name: /next/i })).not.toBeInTheDocument();
  });
});
