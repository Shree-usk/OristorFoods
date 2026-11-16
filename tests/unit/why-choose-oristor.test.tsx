// tests/unit/why-choose-oristor.test.tsx
import { render, screen } from "@testing-library/react";
import { Leaf, ShieldCheck } from "lucide-react";
import { describe, expect, it } from "vitest";

import { WhyChooseOristor } from "@/components/storefront/home/why-choose-oristor";
import type { WhyChooseFeatureData } from "@/types/home";

const features: WhyChooseFeatureData[] = [
  { id: "authentic", icon: Leaf, title: "Authentic Sri Lankan Recipes", description: "Made the traditional way." },
  { id: "quality", icon: ShieldCheck, title: "Premium Quality, Verified", description: "Every batch is checked." },
];

describe("WhyChooseOristor", () => {
  it("renders every feature's title and description, with no section heading", () => {
    render(<WhyChooseOristor features={features} />);
    expect(screen.getByText("Authentic Sri Lankan Recipes")).toBeInTheDocument();
    expect(screen.getByText("Made the traditional way.")).toBeInTheDocument();
    expect(screen.getByText("Premium Quality, Verified")).toBeInTheDocument();
    expect(screen.getByText("Every batch is checked.")).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
