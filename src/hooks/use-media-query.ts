"use client";

import { useSyncExternalStore } from "react";

/**
 * SSR-safe media query hook built on `useSyncExternalStore` — avoids the
 * classic useEffect+useState hydration flash (renders the server snapshot
 * on first paint, then syncs to the real value without a layout jump).
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mediaQueryList = window.matchMedia(query);
      mediaQueryList.addEventListener("change", onChange);
      return () => mediaQueryList.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
