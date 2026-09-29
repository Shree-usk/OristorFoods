import Link from "next/link";
import { Bookmark, Gift, HelpCircle, MapPin, Package, User as UserIcon, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const QUICK_LINKS = [
  { href: "/account/profile", label: "Profile", icon: UserIcon },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/orders", label: "Order History", icon: Package },
  { href: "/account/rewards", label: "Rewards", icon: Gift },
  { href: "/account/referrals", label: "Referrals", icon: Users },
  { href: "/account/saved-recipes", label: "Saved Recipes", icon: Bookmark },
  { href: "/account/support", label: "Support", icon: HelpCircle },
] as const;

/**
 * STORY-033. Static — no data fetch, so it renders immediately alongside
 * the other widgets' <Suspense> fallbacks rather than needing its own.
 * Several targets belong to later Customer Platform stories and aren't
 * built yet — same forward-linking convention the header nav (STORY-004)
 * already uses for /account/orders and /account/rewards.
 */
export function QuickLinksCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick links</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-2 gap-1">
          {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link href={href} className="flex items-center gap-2 rounded-lg p-2 -mx-2 text-small text-charcoal hover:bg-muted">
                <Icon className="size-4 text-charcoal/70" aria-hidden="true" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
