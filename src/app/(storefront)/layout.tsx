import { PageTransition } from "@/components/motion";
import { Footer } from "@/components/storefront/layout/footer";
import { Header } from "@/components/storefront/layout/header";
import { MobileNav } from "@/components/storefront/layout/mobile-nav";

/**
 * Customer-facing shell: header, main content landmark, mobile bottom
 * nav, footer.
 *
 * TanStack Query's `QueryClientProvider` lives in the root layout
 * (`src/app/providers.tsx`), not here — it's not admin-only, both route
 * groups need it, and a single QueryClient instance is the correct
 * default (splitting it per route group would just fragment the cache
 * for no benefit). See docs/architecture-decisions.md.
 *
 * No Zustand "hydration boundary" is needed: `useUiStore` is plain
 * client-only ephemeral UI state, not persisted/rehydrated from the
 * server, so there's no hydration mismatch to guard against. Revisit if
 * a persisted store (zustand/middleware persist) is ever added.
 */
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="print:hidden">
        <Header />
      </div>
      <main id="main-content" className="flex-1 pb-16 lg:pb-0 print:pb-0">
        <PageTransition>{children}</PageTransition>
      </main>
      <div className="print:hidden">
        <MobileNav />
      </div>
      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  );
}
