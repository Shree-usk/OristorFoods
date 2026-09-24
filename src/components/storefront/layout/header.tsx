import { Container } from "./container";
import { HeaderActions } from "./header-actions";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";
import { StickyHeaderShell } from "./sticky-header-shell";

/**
 * Server Component wrapper around a minimal Client Component boundary
 * (StickyHeaderShell for scroll state, NavLinks for active-route
 * highlighting, HeaderActions for badges/session) — per
 * docs/blueprint.md Section 3 ("Server Components by default").
 *
 * Full nav + action cluster only from `lg` (1024px) up — all 13
 * blueprint nav items don't fit at 768px (tablet portrait), so tablet
 * keeps the compact MobileNav pattern (fixed bottom bar, see
 * mobile-nav.tsx) through the `md` breakpoint too, only switching to the
 * full desktop header at `lg`. Below `lg`, only the logo shows here.
 */
export function Header() {
  return (
    <StickyHeaderShell>
      {/* Tighter gaps below `xl`: at 1024px the 13 nav links plus 7 action
          icons only just fit (tests/e2e/layout.spec.ts checks for overflow). */}
      <Container size="wide" className="flex h-full items-center justify-between gap-2 xl:gap-4">
        <Logo />
        <div className="hidden lg:flex">
          <NavLinks />
        </div>
        <div className="hidden lg:flex">
          <HeaderActions />
        </div>
      </Container>
    </StickyHeaderShell>
  );
}
