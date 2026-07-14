"use client";

import { useMediaQuery } from "./use-media-query";

/**
 * Reads the OS-level color scheme preference. Dark mode itself is
 * deferred (STORY-002) — no `.dark` theme values exist yet and nothing
 * currently acts on this value. It's exposed now so a future dark-mode
 * story doesn't have to re-derive the media query at the layout level.
 */
export function usePrefersColorScheme(): "light" | "dark" {
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  return prefersDark ? "dark" : "light";
}
