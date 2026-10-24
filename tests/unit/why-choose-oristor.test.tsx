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
  it("renders the section title, defaulting when no override is set", () => {
    render(<WhyChooseOristor features={features} />);
    expect(screen.getByRole("heading", { name: "Why Choose Oristor" })).toBeInTheDocument();
  });

  it("honours a titleOverride", () => {
    render(<WhyChooseOristor features={features} titleOverride="The Oristor Difference" />);
    expect(screen.getByRole("heading", { name: "The Oristor Difference" })).toBeInTheDocument();
  });

  it("renders every feature's title and description", () => {
    render(<WhyChooseOristor features={features} />);
    expect(screen.getByText("Authentic Sri Lankan Recipes")).toBeInTheDocument();
    expect(screen.getByText("Made the traditional way.")).toBeInTheDocument();
    expect(screen.getByText("Premium Quality, Verified")).toBeInTheDocument();
    expect(screen.getByText("Every batch is checked.")).toBeInTheDocument();
  });
});
