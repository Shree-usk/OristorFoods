import type { MegaMenuSection, NavItem } from "@/lib/nav-config";
import type { FooterColumn } from "@/lib/footer-config";

/**
 * STORY-052. Pure, framework-agnostic — kept out of navigation.service.ts
 * deliberately (that file transitively imports the Node-only Prisma
 * client via menu.repository.ts) so the admin preview pane can reuse the
 * exact same tree-to-NavItem/FooterColumn mapping client-side, on the
 * admin API client's MenuItem rows, as navigation.service.ts uses
 * server-side on the repository's MenuItemRow rows. Same convention as
 * seo-health.ts's split from seo.service.ts (STORY-051a).
 */
export interface MenuTreeItem {
  id: string;
  parentId: string | null;
  sortOrder: number;
  label: string;
  linkType: "None" | "Internal" | "External";
  internalPath: string | null;
  externalUrl: string | null;
  icon: string | null;
  active: boolean;
  contentBlockType: "Link" | "PromoTile";
  promoImageUrl: string | null;
  promoImageAlt: string | null;
  promoHeading: string | null;
  promoCtaLabel: string | null;
}

export function linkHref(item: Pick<MenuTreeItem, "linkType" | "internalPath" | "externalUrl">): string {
  if (item.linkType === "Internal" && item.internalPath) return item.internalPath;
  if (item.linkType === "External" && item.externalUrl) return item.externalUrl;
  return "#";
}

/** Groups a flat MenuItem list by parentId so callers can walk the tree without re-filtering the full array at each level. */
export function groupByParent<T extends MenuTreeItem>(items: T[]) {
  const byParent = new Map<string | null, T[]>();
  for (const item of items) {
    if (!item.active) continue;
    const siblings = byParent.get(item.parentId) ?? [];
    siblings.push(item);
    byParent.set(item.parentId, siblings);
  }
  for (const siblings of byParent.values()) siblings.sort((a, b) => a.sortOrder - b.sortOrder);
  return (parentId: string | null) => byParent.get(parentId) ?? [];
}

export function mapMegaMenuSections<T extends MenuTreeItem>(childrenOf: (parentId: string | null) => T[], topItemId: string): MegaMenuSection[] {
  return childrenOf(topItemId).map((section) => {
    const sectionChildren = childrenOf(section.id);
    const links = sectionChildren.filter((child) => child.contentBlockType === "Link").map((link) => ({ label: link.label, href: linkHref(link) }));
    const promoNode = sectionChildren.find((child) => child.contentBlockType === "PromoTile");
    const promoTile =
      promoNode && promoNode.promoImageUrl && promoNode.promoImageAlt && promoNode.promoHeading && promoNode.promoCtaLabel
        ? { imageUrl: promoNode.promoImageUrl, imageAlt: promoNode.promoImageAlt, heading: promoNode.promoHeading, ctaLabel: promoNode.promoCtaLabel, ctaHref: linkHref(promoNode) }
        : undefined;
    return { heading: section.label, links, promoTile };
  });
}

export function mapHeaderNavItems<T extends MenuTreeItem>(items: T[]): NavItem[] {
  const childrenOf = groupByParent(items);
  return childrenOf(null).map((top) => {
    const megaMenu = mapMegaMenuSections(childrenOf, top.id);
    // icon stays a name string, not a resolved component — this array can
    // cross a Server->Client Component prop boundary (navigation.service.ts
    // calls this from an async Server Component), and a component
    // reference can't serialize across that boundary. Resolved by
    // whichever presentational component actually renders an icon.
    return { label: top.label, href: linkHref(top), icon: top.icon ?? undefined, megaMenu: megaMenu.length > 0 ? megaMenu : undefined };
  });
}

export function mapFooterColumns<T extends MenuTreeItem>(items: T[]): FooterColumn[] {
  const childrenOf = groupByParent(items);
  return childrenOf(null).map((column) => ({
    heading: column.label,
    links: childrenOf(column.id).map((link) => ({ label: link.label, href: linkHref(link) })),
  }));
}

export function mapFlatNavItems<T extends MenuTreeItem>(items: T[]): NavItem[] {
  const childrenOf = groupByParent(items);
  return childrenOf(null).map((item) => ({ label: item.label, href: linkHref(item), icon: item.icon ?? undefined }));
}
