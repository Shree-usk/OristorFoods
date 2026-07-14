"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { mobileNavItems } from "@/lib/nav-config";
import { useCartStore } from "@/lib/stores/cart-store";
import { MobileMenuDrawer } from "./mobile-menu-drawer";

/**
 * Fixed bottom nav bar, mobile-only (`md:hidden`) — the exact 8-item
 * list from docs/blueprint.md Section 4: Home, Products, Recipes,
 * Search, Rewards, Account, Menu, Cart. "Menu" opens the off-canvas
 * drawer with the remaining desktop-only links instead of navigating.
 */
export function MobileNav() {
  const pathname = usePathname();
  const cartCount = useCartStore((state) => state.count);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Close the drawer on route change (AC: closes on route change). Setting
  // state during render — rather than in a useEffect — is the React-blessed
  // pattern for "adjust state when a prop changes" and avoids the extra
  // commit a useEffect-based reset would cause.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setIsDrawerOpen(false);
  }

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-stretch border-t border-border bg-background/95 backdrop-blur lg:hidden"
      >
        {mobileNavItems.map((item) => {
          const isMenuButton = item.href === "#menu";
          const isActive = !isMenuButton && (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href));
          const showCartBadge = item.label === "Cart" && cartCount > 0;

          const content = (
            <>
              {/* Icon: text-stone is fine here — it's a graphical/UI
                  component, which WCAG only requires 3:1 contrast for
                  (stone-on-ivory is 3.56:1). The label below needs the
                  stricter 4.5:1 normal-text ratio, so it uses charcoal
                  instead — see docs/architecture-decisions.md's contrast
                  table from STORY-002, which flagged this exact combo. */}
              <span className={cn("relative", isActive ? "text-primary" : "text-stone")}>
                <item.icon className="size-5" aria-hidden="true" />
                {showCartBadge && (
                  <span className="absolute -top-1 -right-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] leading-none text-primary-foreground">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </span>
              <span
                className={cn("text-[10px] leading-none", isActive ? "text-primary" : "text-charcoal")}
              >
                {item.label}
              </span>
            </>
          );

          const itemClassName = "flex flex-1 flex-col items-center justify-center gap-1";

          if (isMenuButton) {
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={isDrawerOpen}
                className={itemClassName}
              >
                {content}
              </button>
            );
          }

          return (
            <Link key={item.href} href={item.href} className={itemClassName}>
              {content}
            </Link>
          );
        })}
      </nav>
      <MobileMenuDrawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen} />
    </>
  );
}
