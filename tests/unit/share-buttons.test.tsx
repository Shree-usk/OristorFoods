import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ShareButtons } from "@/components/storefront/product/share-buttons";

describe("ShareButtons", () => {
  it("copies the product URL to the clipboard and shows confirmation", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    render(<ShareButtons url="https://oristor.com/products/curry-powder" title="Curry Powder" />);
    await user.click(screen.getByRole("button", { name: "Copy link" }));

    expect(writeText).toHaveBeenCalledWith("https://oristor.com/products/curry-powder");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Copied!"));
  });

  it("builds correct share links for WhatsApp, Facebook, X, and email", () => {
    render(<ShareButtons url="https://oristor.com/products/curry-powder" title="Curry Powder" />);

    expect(screen.getByRole("link", { name: "Share on WhatsApp" })).toHaveAttribute(
      "href",
      expect.stringContaining("wa.me"),
    );
    expect(screen.getByRole("link", { name: "Share on Facebook" })).toHaveAttribute(
      "href",
      expect.stringContaining("facebook.com/sharer"),
    );
    expect(screen.getByRole("link", { name: "Share on X" })).toHaveAttribute(
      "href",
      expect.stringContaining("twitter.com/intent/tweet"),
    );
    expect(screen.getByRole("link", { name: "Share by email" })).toHaveAttribute(
      "href",
      expect.stringContaining("mailto:"),
    );
  });
});
