"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { DEFAULT_EASE } from "./variants";

/**
 * Site-wide page-to-page transition, wired into
 * `src/app/(storefront)/layout.tsx` around `{children}`.
 *
 * Deliberately entrance-only (fade+rise on mount, keyed by pathname) —
 * **not** a full `AnimatePresence` enter/exit choreography. Exit
 * animations require delaying unmount until the animation finishes,
 * which fights the App Router's streaming/Suspense model and risks
 * blocking or duplicating server-rendered content during navigation.
 * An entrance-only fade gets the "page feels transitions" effect
 * blueprint Section 3 asks for without that fragility. Revisit only if
 * a specific design calls for a true exit transition, and prototype it
 * carefully against streaming routes first.
 *
 * Server-rendered content is unaffected: this wraps already-rendered
 * children in a client-side `motion.div`, it doesn't block or delay the
 * initial paint/streaming of the page itself.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: DEFAULT_EASE }}
    >
      {children}
    </motion.div>
  );
}
