import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Container } from "@/components/storefront/layout/container";
import { Section } from "@/components/storefront/layout/section";

describe("Container", () => {
  it("applies the default max-width class", () => {
    render(<Container data-testid="container">content</Container>);
    expect(screen.getByTestId("container")).toHaveClass("max-w-7xl");
  });

  it("applies the narrow max-width class when size='narrow'", () => {
    render(
      <Container data-testid="container" size="narrow">
        content
      </Container>,
    );
    expect(screen.getByTestId("container")).toHaveClass("max-w-3xl");
  });

  it("applies the wide max-width class when size='wide'", () => {
    render(
      <Container data-testid="container" size="wide">
        content
      </Container>,
    );
    expect(screen.getByTestId("container")).toHaveClass("max-w-[100rem]");
  });
});

describe("Section", () => {
  it("wraps children in a Container by default", () => {
    render(
      <Section data-testid="section">
        <p>child</p>
      </Section>,
    );
    const section = screen.getByTestId("section");
    expect(section.querySelector('[data-slot="container"]')).not.toBeNull();
  });

  it("skips the Container when containerSize is false", () => {
    render(
      <Section data-testid="section" containerSize={false}>
        <p>child</p>
      </Section>,
    );
    const section = screen.getByTestId("section");
    expect(section.querySelector('[data-slot="container"]')).toBeNull();
  });

  it("applies the requested spacing class", () => {
    render(
      <Section data-testid="section" spacing="xl">
        content
      </Section>,
    );
    expect(screen.getByTestId("section")).toHaveClass("py-24");
  });
});
