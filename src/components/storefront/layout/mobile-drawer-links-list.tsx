import Link from "next/link";

import type { NavItem } from "@/lib/nav-config";
import { resolveMenuIcon } from "@/lib/menu-icons";

/**
 * STORY-052. Extracted out of mobile-menu-drawer.tsx so the admin preview
 * pane can render this exact presentational markup against draft data
 * too, not a separate mock — mobile-menu-drawer.tsx uses it for the real,
 * published drawer. `onItemClick` is only wired by the real drawer (to
 * close the Sheet); the preview pane omits it.
 */
export function MobileDrawerLinksList({ items, onItemClick }: { items: NavItem[]; onItemClick?: () => void }) {
  return (
    <nav aria-label="More" className="flex flex-col gap-1 px-4 pb-4">
      {items.map((item) => {
        const Icon = resolveMenuIcon(item.icon ?? null);
        return (
          <Link key={item.href} href={item.href} onClick={onItemClick} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-body hover:bg-muted">
            {Icon && <Icon className="size-5" aria-hidden="true" />}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
