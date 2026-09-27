import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DownloadCard } from "@/components/storefront/downloads/download-card";
import type { DownloadResourceCard } from "@/types/download";

const resource: DownloadResourceCard = {
  id: "resource-1",
  slug: "nutrition-guide",
  title: "Nutrition Guide",
  description: "A guide to reading nutrition labels.",
  thumbnailUrl: "/images/products/export/curry-powder.webp",
  fileType: "PDF",
  fileSizeBytes: 1_258_291,
  requiresAuth: false,
  category: { id: "cat-1", name: "Nutrition Guides", slug: "nutrition-guides" },
};

describe("DownloadCard", () => {
  it("renders the title, category, and formatted size", () => {
    render(<DownloadCard resource={resource} />);
    expect(screen.getByText("Nutrition Guide")).toBeInTheDocument();
    expect(screen.getByText("Nutrition Guides")).toBeInTheDocument();
    expect(screen.getByText("PDF · 1.2 MB")).toBeInTheDocument();
  });

  it("gives the download link a descriptive accessible name, not a bare 'Download'", () => {
    render(<DownloadCard resource={resource} />);
    const link = screen.getByRole("link", { name: "Download Nutrition Guide, PDF · 1.2 MB" });
    expect(link).toHaveAttribute("href", "/api/downloads/nutrition-guide/file");
    expect(link).toHaveAttribute("download");
  });
});
