import type { Variants } from "framer-motion";

/**
 * Shared timing/easing — "warm, confident, premium" (blueprint Section 2)
 * reads as unhurried but not sluggish: a touch longer than typical UI
 * micro-interactions (150-200ms), with a gentle ease-out rather than a
 * bouncy/springy curve.
 */
export const DEFAULT_DURATION = 0.5;
export const DEFAULT_EASE = [0.22, 1, 0.36, 1] as const; // "ease-out-quint"-ish

/**
 * Fade + rise entrance. The default `ScrollReveal` variant — use for
 * most card grids, section headings, and hero content.
 *
 * @example
 * <ScrollReveal variant={fadeInUp}>...</ScrollReveal>
 */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: DEFAULT_DURATION, ease: DEFAULT_EASE },
  },
};

/** Plain opacity fade, no movement — use when a layout can't afford any
 * transform-induced reflow risk (e.g. content near a fixed-position edge). */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: DEFAULT_DURATION, ease: DEFAULT_EASE },
  },
};

/** Subtle scale-up entrance — use sparingly, for single hero/feature
 * elements rather than repeated grid items (feels heavy at scale). */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: DEFAULT_DURATION, ease: DEFAULT_EASE },
  },
};

/**
 * Wrap a `motion.div` using this as the parent variant, with children
 * using `fadeInUp`/`fadeIn`/`scaleIn`, to stagger a card grid's entrance
 * instead of every card animating in simultaneously.
 *
 * @example
 * <motion.div variants={staggerContainer} initial="hidden" whileInView="visible">
 *   {items.map((item) => <motion.div key={item.id} variants={fadeInUp}>...</motion.div>)}
 * </motion.div>
 */
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

/** Micro-interaction props for hoverable cards/buttons — spread onto a
 * `motion.div`/`motion.button`: `<motion.div {...hoverLift}>`. */
export const hoverLift = {
  whileHover: { y: -4 },
  whileTap: { scale: 0.98 },
  transition: { duration: 0.15, ease: DEFAULT_EASE },
};

/** Micro-interaction props for a plain scale press (icon buttons, etc). */
export const tapScale = {
  whileTap: { scale: 0.94 },
  transition: { duration: 0.1 },
};
