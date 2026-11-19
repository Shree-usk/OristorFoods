"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin/perfect-match", label: "Settings" },
  { href: "/admin/perfect-match/products", label: "Products" },
];

/**
 * Route-based "tabs" (plain Links styled like TabsList/TabsTrigger) rather
 * than client-state Tabs — the product detail page needs a real,
 * deep-linkable route (/products/[id]), same reasoning as
 * admin-food-academy-nav.tsx.
 */
export function AdminPerfectMatchNav() {
  const pathname = usePathname();

  return (
    <div className="inline-flex h-8 w-fit items-center justify-center gap-1 rounded-lg bg-muted p-0.5 text-muted-foreground">
      {LINKS.map((link) => {
        const isActive = link.href === "/admin/perfect-match" ? pathname === link.href : pathname.startsWith(link.href);
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
