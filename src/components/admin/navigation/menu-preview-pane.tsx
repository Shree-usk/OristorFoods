"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { NavigationMenu, NavigationMenuContent, NavigationMenuItem, NavigationMenuList } from "@/components/ui/navigation-menu";
import { FooterColumnsGrid } from "@/components/storefront/layout/footer-columns-grid";
import { MegaMenuPanel } from "@/components/storefront/layout/mega-menu";
import { MobileDrawerLinksList } from "@/components/storefront/layout/mobile-drawer-links-list";
import { NavLinks } from "@/components/storefront/layout/nav-links";
import type { MenuItem, MenuLocationValue } from "@/lib/api/admin-navigation-client";
import { groupByParent, mapFlatNavItems, mapFooterColumns, mapHeaderNavItems, mapMegaMenuSections, type MenuTreeItem } from "@/lib/menu-tree";

/**
 * STORY-052. Renders the *real* NavLinks/MegaMenuPanel/footer/mobile-
 * drawer presentational components against the current draft tree,
 * mapped through the exact same src/lib/menu-tree.ts functions
 * navigation.service.ts uses server-side for the published menu —
 * proves the preview is pixel-faithful by construction, not a mock.
 */
export function MenuPreviewPane({ location, items }: { location: MenuLocationValue; items: MenuItem[] }) {
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const treeItems: MenuTreeItem[] = items;

  return (
    <div className="rounded-md border border-border p-4">
      <div className="mb-3 flex items-center gap-2">
        <Button size="sm" variant={viewport === "desktop" ? "default" : "outline"} onClick={() => setViewport("desktop")}>
          Desktop
        </Button>
        <Button size="sm" variant={viewport === "mobile" ? "default" : "outline"} onClick={() => setViewport("mobile")}>
          Mobile
        </Button>
      </div>

      <div className={viewport === "mobile" ? "mx-auto max-w-80 overflow-x-auto" : ""}>
        {location === "Header" && <NavLinks items={mapHeaderNavItems(treeItems)} />}
        {location === "Footer" && (
          <div className="rounded-md bg-charcoal p-4">
            <FooterColumnsGrid columns={mapFooterColumns(treeItems)} />
          </div>
        )}
        {location === "Mobile" && <MobileDrawerLinksList items={mapFlatNavItems(treeItems)} />}
      </div>
    </div>
  );
}

/**
 * The Mega Menu tab's own preview — the flyout panel for one Header
 * item's sections, independent of the Header tab's own preview above.
 * MegaMenuPanel's links use NavigationMenuLink internally (it's normally
 * rendered inside NavigationMenuContent as part of a real NavLinks
 * trigger/hover flow), which throws if there's no NavigationMenuRoot
 * context above it — forced open via a fixed defaultValue instead of a
 * real trigger, since this preview has no hover interaction to drive it.
 */
export function MegaMenuPreview({ items, topItemId }: { items: MenuItem[]; topItemId: string }) {
  const treeItems: MenuTreeItem[] = items;
  const childrenOf = groupByParent(treeItems);
  const sections = mapMegaMenuSections(childrenOf, topItemId);

  return (
    <div className="rounded-md border border-border p-4">
      <NavigationMenu defaultValue="preview">
        <NavigationMenuList>
          <NavigationMenuItem value="preview">
            <NavigationMenuContent>
              <MegaMenuPanel sections={sections} />
            </NavigationMenuContent>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
}
