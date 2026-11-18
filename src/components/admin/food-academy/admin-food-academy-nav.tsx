"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin/food-academy", label: "Page settings" },
  { href: "/admin/food-academy/categories", label: "Categories" },
  { href: "/admin/food-academy/entries", label: "Entries" },
];

/**
 * Route-based "tabs" (plain Links styled like TabsList/TabsTrigger) rather
 * than Base UI's client-state Tabs — Entries needs real, deep-linkable
 * routes (list, new, [id]) that a client-only tab panel can't provide, so
 * every section here is its own page rather than a TabsContent panel.
 */
export function AdminFoodAcademyNav() {
  const pathname = usePathname();

  return (
    <div className="inline-flex h-8 w-fit items-center justify-center gap-1 rounded-lg bg-muted p-0.5 text-muted-foreground">
      {LINKS.map((link) => {
        const isActive = link.href === "/admin/food-academy" ? pathname === link.href : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "inline-flex h-full items-center justify-center rounded-md px-2.5 py-1 text-sm font-medium whitespace-nowrap text-foreground transition-[color,box-shadow]",
              isActive && "bg-background shadow-sm",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
