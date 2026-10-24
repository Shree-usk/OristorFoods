// tests/unit/export-banner.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExportBanner } from "@/components/storefront/home/export-banner";
import { exportSolutions } from "@/lib/fixtures/home-fixtures";

describe("ExportBanner", () => {
  it("renders the eyebrow, headline, description, and a CTA linking to the export catalogue", () => {
    render(<ExportBanner data={exportSolutions} />);

    expect(screen.getByText(exportSolutions.eyebrow)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: exportSolutions.headline })).toBeInTheDocument();
    expect(screen.getByText(exportSolutions.description)).toBeInTheDocument();

    // Base UI's Button-as-link renders role="button" on the anchor, not role="link".
    const cta = screen.getByRole("button", { name: exportSolutions.ctaLabel });
    expect(cta).toHaveAttribute("href", "/export");
  });
});
