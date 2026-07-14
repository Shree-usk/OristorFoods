import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Container, type containerVariants } from "./container";
import type { VariantProps as CVAVariantProps } from "class-variance-authority";

/**
 * Vertical rhythm primitive for homepage-style / content sections.
 * `spacing` controls the py-* scale so every section (Hero, Featured
 * Categories, Homepage Visual Builder blocks, etc. — STORY-006 onward)
 * shares one consistent rhythm instead of hand-picked padding per page.
 */
const sectionVariants = cva("w-full", {
  variants: {
    spacing: {
      sm: "py-8 md:py-12",
      default: "py-12 md:py-16",
      lg: "py-16 md:py-24",
      xl: "py-24 md:py-32",
    },
  },
  defaultVariants: {
    spacing: "default",
  },
});

interface SectionProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof sectionVariants> {
  /** Passed through to the inner `Container`; set `false` to skip it entirely. */
  containerSize?: CVAVariantProps<typeof containerVariants>["size"] | false;
}

function Section({
  className,
  spacing,
  containerSize = "default",
  children,
  ...props
}: SectionProps) {
  return (
    <section data-slot="section" className={cn(sectionVariants({ spacing, className }))} {...props}>
      {containerSize === false ? children : <Container size={containerSize}>{children}</Container>}
    </section>
  );
}

export { Section, sectionVariants };
