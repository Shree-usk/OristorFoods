"use client";

import { motion, type Variants } from "framer-motion";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { fadeInUp } from "./variants";

interface ScrollRevealProps {
  children: React.ReactNode;
  /** Defaults to `fadeInUp` — pass `fadeIn`/`scaleIn`/a custom Variants object. */
  variant?: Variants;
  /** Seconds to delay the animation start (e.g. for staggering siblings by hand). */
  delay?: number;
  /** Replay every time the element scrolls into view instead of once. Default: false (animate once). */
  repeat?: boolean;
  /** Fraction of the element that must be visible before triggering. Default: 0.2. */
  amount?: number;
  className?: string;
}

/**
 * Reveals children on scroll-into-view via Framer Motion's `whileInView`.
 * The primitive homepage sections (STORY-006) and future pages should
 * use for entrance animation instead of hand-rolling `whileInView`.
 *
 * When the user prefers reduced motion, renders children in their final
 * ("visible") state immediately — no transition, no scroll listener
 * needed, and no layout shift either way since `fadeInUp`/`fadeIn`/
 * `scaleIn` only ever animate opacity/transform, never layout-affecting
 * properties.
 *
 * @example
 * <ScrollReveal><ProductCard {...card} /></ScrollReveal>
 * <ScrollReveal variant={fadeIn} delay={0.1}>...</ScrollReveal>
 */
export function ScrollReveal({
  children,
  variant = fadeInUp,
  delay = 0,
  repeat = false,
  amount = 0.2,
  className,
}: ScrollRevealProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: !repeat, amount }}
      variants={variant}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}
