import Link from "next/link";

import { NavigationMenuLink } from "@/components/ui/navigation-menu";
import type { MegaMenuSection } from "@/lib/nav-config";

/**
 * Flyout panel body rendered inside a NavigationMenuContent for nav items
 * that define `megaMenu` (Products, Recipes) — see nav-links.tsx.
 */
export function MegaMenuPanel({ sections }: { sections: MegaMenuSection[] }) {
  return (
    <div className="grid min-w-56 gap-4 p-2">
      {sections.map((section) => (
        <div key={section.heading}>
          <p className="px-2 pb-1 text-caption font-medium text-stone uppercase tracking-wide">
            {section.heading}
          </p>
          <ul className="flex flex-col">
            {section.links.map((link) => (
              <li key={link.href}>
                <NavigationMenuLink closeOnClick render={<Link href={link.href} />}>
                  {link.label}
                </NavigationMenuLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
