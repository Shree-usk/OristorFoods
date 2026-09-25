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

  it("does not throw when the Clipboard API is unavailable", async () => {
    const user = userEvent.setup();
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });

    render(<ShareButtons url="https://oristor.com/products/curry-powder" title="Curry Powder" />);
    await user.click(screen.getByRole("button", { name: "Copy link" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    Object.defineProperty(navigator, "clipboard", { value: originalClipboard, configurable: true });
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

  it("does not render a native share button when navigator.share is unavailable", () => {
    render(<ShareButtons url="https://oristor.com/products/curry-powder" title="Curry Powder" />);
    expect(screen.queryByRole("button", { name: "Share via device" })).not.toBeInTheDocument();
  });

  it("calls navigator.share with the title and url when available", async () => {
    const user = userEvent.setup();
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { value: share, configurable: true });

    render(<ShareButtons url="https://oristor.com/products/curry-powder" title="Curry Powder" />);
    await user.click(screen.getByRole("button", { name: "Share via device" }));

    expect(share).toHaveBeenCalledWith({ title: "Curry Powder", url: "https://oristor.com/products/curry-powder" });

    // Clean up so this doesn't leak into other tests in the file (navigator.share
    // does not exist by default in jsdom, so delete it back to that state).
    // @ts-expect-error -- reverting to the undefined-by-default jsdom state
    delete navigator.share;
  });
});
