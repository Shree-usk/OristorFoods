import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/system-settings.service", () => ({ getResolvedAnnouncementBar: vi.fn() }));

import { AnnouncementBar } from "@/components/storefront/layout/announcement-bar";
import { getResolvedAnnouncementBar } from "@/services/system-settings.service";

describe("AnnouncementBar", () => {
  it("renders nothing when there's no resolved announcement", async () => {
    vi.mocked(getResolvedAnnouncementBar).mockResolvedValue(null);
    const { container } = render(await AnnouncementBar());
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a plain message with no link", async () => {
    vi.mocked(getResolvedAnnouncementBar).mockResolvedValue({
      message: "Authentic Sri Lankan flavours, made with care.",
      linkLabel: null,
      linkHref: null,
    });
    render(await AnnouncementBar());
    expect(screen.getByText("Authentic Sri Lankan flavours, made with care.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders the message and link label as a single link to linkHref", async () => {
    vi.mocked(getResolvedAnnouncementBar).mockResolvedValue({
      message: "Free delivery over LKR 10,000",
      linkLabel: "Shop now",
      linkHref: "/products",
    });
    render(await AnnouncementBar());
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/products");
    expect(link).toHaveTextContent("Free delivery over LKR 10,000Shop now");
  });
});
