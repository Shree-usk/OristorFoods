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
import { cn } from "@/lib/utils";
import { MegaMenuPanel } from "./mega-menu";

/**
 * Red underline under the current section — applied in JS from `isActive`
 * rather than a `data-active` CSS selector, since NavigationMenuTrigger
 * (used for Products/Recipes) has no `active` prop of its own to drive
 * one: the trigger just opens a flyout, it isn't itself a link.
 */
const activeIndicatorClass =
  "relative after:absolute after:inset-x-2 after:-bottom-0.5 after:h-0.5 after:rounded-full after:bg-primary";

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
      <NavigationMenuList className="gap-0 xl:gap-1.5">
        {items.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          if (item.megaMenu) {
            return (
              <NavigationMenuItem key={item.href}>
                <NavigationMenuTrigger className={cn("px-1.5 text-sm font-medium xl:px-2.5", isActive && activeIndicatorClass)}>
                  {item.label}
                </NavigationMenuTrigger>
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
                className={cn("px-1.5 text-sm font-medium xl:px-2", isActive && activeIndicatorClass)}
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
