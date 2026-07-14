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
import { primaryNavItems } from "@/lib/nav-config";
import { MegaMenuPanel } from "./mega-menu";

/**
 * Desktop primary nav (Home, Products, Recipes, Food Academy, Export,
 * Blog, About, Contact). Products/Recipes get a mega-menu flyout; the
 * rest are plain links. Active route is highlighted via `usePathname` —
 * requires this to be a Client Component boundary.
 */
export function NavLinks() {
  const pathname = usePathname();

  return (
    <NavigationMenu>
      <NavigationMenuList>
        {primaryNavItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

          if (item.megaMenu) {
            return (
              <NavigationMenuItem key={item.href}>
                <NavigationMenuTrigger>{item.label}</NavigationMenuTrigger>
                <NavigationMenuContent>
                  <MegaMenuPanel sections={item.megaMenu} />
                </NavigationMenuContent>
              </NavigationMenuItem>
            );
          }

          return (
            <NavigationMenuItem key={item.href}>
              <NavigationMenuLink active={isActive} render={<Link href={item.href} />}>
                {item.label}
              </NavigationMenuLink>
            </NavigationMenuItem>
          );
        })}
      </NavigationMenuList>
    </NavigationMenu>
  );
}
