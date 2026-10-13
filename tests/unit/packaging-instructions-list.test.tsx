import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PackagingInstructionsList } from "@/components/storefront/product/packaging-instructions-list";

describe("PackagingInstructionsList", () => {
  it("renders nothing for empty/whitespace-only text", () => {
    const { container } = render(<PackagingInstructionsList text={"   \n  \n"} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a single line as plain text, not a numbered list", () => {
    render(<PackagingInstructionsList text="Keep refrigerated after opening." />);
    expect(screen.getByText("Keep refrigerated after opening.").tagName).toBe("P");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("renders multiple newline-separated lines as a numbered list, dropping blank lines", () => {
    render(<PackagingInstructionsList text={"Keep refrigerated after opening.\n\nDo not freeze.\nConsume within 3 days of opening."} />);
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Keep refrigerated after opening.",
      "Do not freeze.",
      "Consume within 3 days of opening.",
    ]);
  });
});
