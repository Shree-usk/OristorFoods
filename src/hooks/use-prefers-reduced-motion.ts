"use client";

import { useMediaQuery } from "./use-media-query";

/**
 * Exposed at the layout level so STORY-008 (Animation Framework) and any
 * component with motion can read this without re-deriving the media query.
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
