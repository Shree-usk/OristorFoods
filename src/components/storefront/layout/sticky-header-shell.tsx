"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * The only client-side concern in the header: toggling a border/shadow
 * once the page scrolls. Header height doesn't change between scroll
 * states, so that alone cannot cause layout shift — see
 * docs/architecture-decisions.md. Uses `min-h` rather than a fixed `h` so
 * that if nav content ever wraps to two lines at a cramped viewport width
 * (e.g. exactly 1024px with all 13 blueprint nav items), the header grows
 * to fit instead of clipping — graceful degradation over a hard clip.
 */
export function StickyHeaderShell({ children }: { children: React.ReactNode }) {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 min-h-(--header-height) w-full bg-background/95 backdrop-blur transition-shadow duration-200",
        isScrolled ? "border-b border-border shadow-sm" : "border-b border-transparent",
      )}
    >
      {children}
    </header>
  );
}
