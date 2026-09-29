"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ACCOUNT_NAV_ITEMS = [
  { href: "/account", label: "Dashboard" },
  { href: "/account/profile", label: "Profile" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/security", label: "Security" },
  { href: "/account/notifications", label: "Notifications" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/rewards", label: "Rewards" },
  { href: "/account/referrals", label: "Referrals" },
  { href: "/account/saved-recipes", label: "Saved Recipes" },
  { href: "/account/support", label: "Support" },
] as const;

/** STORY-033/034. The guarded account area's tab nav — several targets are later Customer Platform stories, not yet built. */
export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Account" className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <ul className="flex gap-1 border-b border-input">
        {ACCOUNT_NAV_ITEMS.map((item) => {
          const isActive = item.href === "/account" ? pathname === "/account" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`inline-block border-b-2 px-3 py-2 text-small font-medium whitespace-nowrap ${
                  isActive ? "border-chilli text-charcoal" : "border-transparent text-charcoal/60 hover:text-charcoal"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
