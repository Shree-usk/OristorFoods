import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownContent } from "@/components/shared/markdown-content";

describe("MarkdownContent", () => {
  it("renders a heading, a list, and a link", () => {
    render(<MarkdownContent content={"## Storage tips\n\n- Keep cool\n- Keep dry\n\n[Read more](https://example.com)"} />);
    expect(screen.getByRole("heading", { level: 2, name: "Storage tips" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Read more" })).toHaveAttribute("href", "https://example.com");
  });

  it("does not execute raw HTML embedded in the markdown source", () => {
    render(<MarkdownContent content={'Before <script>window.__pwned = true;</script> after'} />);
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
    expect(document.querySelector("script[data-testid], script:not([type='application/ld+json'])")).not.toBeInTheDocument();
  });

  it("does not execute an event-handler attribute embedded in raw HTML", () => {
    render(<MarkdownContent content={'<img src="x" onerror="window.__pwned2 = true">'} />);
    expect((window as unknown as { __pwned2?: boolean }).__pwned2).toBeUndefined();
  });

  it("renders bold and italic emphasis", () => {
    render(<MarkdownContent content={"This is **bold** and this is *italic*."} />);
    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.getByText("italic").tagName).toBe("EM");
  });
});
