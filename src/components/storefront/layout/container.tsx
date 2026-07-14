import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Enforces the site's max content width + horizontal gutter at every
 * breakpoint. Use this instead of ad-hoc `max-w-*`/`px-*` combinations in
 * page code so container width stays consistent across every route.
 */
const containerVariants = cva("mx-auto w-full px-4 sm:px-6 lg:px-8", {
  variants: {
    size: {
      // Body copy / forms — checkout, blog post, account pages.
      narrow: "max-w-3xl",
      // Default page content width — product grids, most sections.
      default: "max-w-7xl",
      // Full-bleed hero/banner sections that still want a gutter.
      wide: "max-w-[100rem]",
    },
  },
  defaultVariants: {
    size: "default",
  },
});

interface ContainerProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof containerVariants> {}

function Container({ className, size, ...props }: ContainerProps) {
  return (
    <div data-slot="container" className={cn(containerVariants({ size, className }))} {...props} />
  );
}

export { Container, containerVariants };
