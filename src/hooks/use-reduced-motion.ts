"use client";

import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

/**
 * Thin, motion-module-scoped re-export of `usePrefersReducedMotion`
 * (STORY-003) — every exported primitive in `src/components/motion/`
 * imports this one, rather than each re-deriving the media query, per
 * the "no duplicate logic" rule (docs/blueprint.md Section 8).
 */
export const useReducedMotion = usePrefersReducedMotion;
