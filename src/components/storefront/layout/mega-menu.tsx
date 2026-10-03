import Image from "next/image";
import Link from "next/link";

import { NavigationMenuLink } from "@/components/ui/navigation-menu";
import type { MegaMenuSection } from "@/lib/nav-config";

/**
 * Flyout panel body rendered inside a NavigationMenuContent for nav items
 * that define `megaMenu` (Products, Recipes) — see nav-links.tsx. A
 * section's optional promoTile (STORY-052) renders as a card alongside
 * its link list, not instead of it — "rich content blocks ... alongside
 * plain links, not just flat link lists" per that story's AC.
 */
export function MegaMenuPanel({ sections }: { sections: MegaMenuSection[] }) {
  return (
    <div className="grid min-w-56 gap-4 p-2 sm:grid-flow-col sm:auto-cols-max">
      {sections.map((section) => (
        <div key={section.heading} className="flex gap-4">
          <div>
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
          {section.promoTile && (
            <Link
              href={section.promoTile.ctaHref}
              className="relative flex w-40 shrink-0 flex-col overflow-hidden rounded-lg border border-border"
            >
              <div className="relative h-24 w-full">
                <Image src={section.promoTile.imageUrl} alt={section.promoTile.imageAlt} fill className="object-cover" />
              </div>
              <div className="p-2">
                <p className="text-small font-medium text-charcoal">{section.promoTile.heading}</p>
                <p className="text-caption text-primary">{section.promoTile.ctaLabel}</p>
              </div>
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
