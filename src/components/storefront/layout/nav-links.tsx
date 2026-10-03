"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import type { NavItem } from "@/lib/nav-config";
import { MegaMenuPanel } from "./mega-menu";

/**
 * Desktop primary nav (Home, Products, Recipes, Food Academy, Export,
 * Blog, About, Contact by default). Items come from the parent Server
 * Component (header.tsx), which resolves the published Header menu
 * (STORY-052) and falls back to nav-config.ts's static defaults until
 * one's been published — this component itself is presentational.
 * Products/Recipes get a mega-menu flyout; the rest are plain links.
 * Active route is highlighted via `usePathname` — requires this to be a
 * Client Component boundary.
 */
export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <NavigationMenu>
      <NavigationMenuList>
        {items.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          if (item.megaMenu) {
            return (
              <NavigationMenuItem key={item.href}>
                <NavigationMenuTrigger className="px-1.5 xl:px-2.5">{item.label}</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <MegaMenuPanel sections={item.megaMenu} />
                </NavigationMenuContent>
              </NavigationMenuItem>
            );
          }

          return (
            <NavigationMenuItem key={item.href}>
              <NavigationMenuLink
                active={isActive}
                className="px-1.5 xl:px-2"
                render={<Link href={item.href} />}
              >
                {item.label}
              </NavigationMenuLink>
            </NavigationMenuItem>
          );
        })}
      </NavigationMenuList>
    </NavigationMenu>
  );
}
