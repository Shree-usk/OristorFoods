import type { MenuContentBlockType, MenuItemVisibility, MenuLinkType, MenuLocation } from "@/generated/prisma/client";
import type { CustomerGroup } from "@/generated/prisma/client";
import { footerColumns, type FooterColumn } from "@/lib/footer-config";
import { mapFlatNavItems, mapFooterColumns, mapHeaderNavItems } from "@/lib/menu-tree";
import { mobileDrawerItems, primaryNavItems, type NavItem } from "@/lib/nav-config";
import * as menuRepository from "@/repositories/menu.repository";
import type { MenuDetail } from "@/repositories/menu.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { InvalidContentBlockError, InvalidLinkTargetError, MaxDepthExceededError, MenuItemNotFoundError, MenuNotFoundError, NoArchivedMenuError } from "@/services/navigation.errors";
import { requirePermission } from "@/services/permission.service";

/**
 * STORY-052. Header items may nest 2 levels deep (top item → mega-menu
 * section heading → link/promo tile) since the AC explicitly asks for
 * mega-menu columns; Footer 1 level (column heading → link); Mobile is
 * flat — mirrors the real shape of nav-config.ts/footer-config.ts today.
 */
const MAX_DEPTH_BY_LOCATION: Record<MenuLocation, number> = {
  Header: 2,
  Footer: 1,
  Mobile: 0,
};

/** Always exactly one Draft per location to keep editing simple — auto-vivifies an empty one on first access rather than requiring an explicit "new draft" action (unlike the Homepage Builder's multi-draft model, which this story doesn't need). */
export async function getDraftMenu(adminUserId: string, location: MenuLocation): Promise<MenuDetail> {
  await requirePermission(adminUserId, "Navigation", "View");

  const existing = await menuRepository.findDraftMenu(location);
  if (existing) return existing;

  return menuRepository.createMenu({ location, createdBy: { connect: { id: adminUserId } }, updatedBy: { connect: { id: adminUserId } } });
}

export async function getPublishedMenu(adminUserId: string, location: MenuLocation): Promise<MenuDetail | null> {
  await requirePermission(adminUserId, "Navigation", "View");
  return menuRepository.findPublishedMenu(location);
}

/** The storefront's own read — no admin permission check, since this feeds the real Header/Footer/MobileNav rendering for every visitor. */
export function getPublishedMenuForStorefront(location: MenuLocation): Promise<MenuDetail | null> {
  return menuRepository.findPublishedMenu(location);
}

function validateLinkTarget(linkType: MenuLinkType, internalPath: string | null, externalUrl: string | null): void {
  if (linkType === "Internal" && (!internalPath || externalUrl)) throw new InvalidLinkTargetError();
  if (linkType === "External" && (!externalUrl || internalPath)) throw new InvalidLinkTargetError();
  if (linkType === "None" && (internalPath || externalUrl)) throw new InvalidLinkTargetError();
}

export interface MenuItemInput {
  parentId: string | null;
  label: string;
  linkType: MenuLinkType;
  internalPath: string | null;
  externalUrl: string | null;
  openInNewTab: boolean;
  icon: string | null;
  visibility: MenuItemVisibility;
  targetCustomerGroup: CustomerGroup | null;
  active: boolean;
  contentBlockType: MenuContentBlockType;
  promoImageUrl: string | null;
  promoImageAlt: string | null;
  promoHeading: string | null;
  promoCtaLabel: string | null;
}

async function requireMenu(id: string): Promise<MenuDetail> {
  const menu = await menuRepository.findMenuById(id);
  if (!menu) throw new MenuNotFoundError();
  return menu;
}

async function requireItemInMenu(menuId: string, itemId: string) {
  const item = await menuRepository.findItemById(itemId);
  if (!item || item.menuId !== menuId) throw new MenuItemNotFoundError();
  return item;
}

export async function addItem(adminUserId: string, menuId: string, input: MenuItemInput) {
  await requirePermission(adminUserId, "Navigation", "Edit");
  const menu = await requireMenu(menuId);

  validateLinkTarget(input.linkType, input.internalPath, input.externalUrl);
  if (input.contentBlockType === "PromoTile" && menu.location !== "Header") throw new InvalidContentBlockError();

  const depth = await menuRepository.computeChildDepth(input.parentId);
  if (depth > MAX_DEPTH_BY_LOCATION[menu.location]) throw new MaxDepthExceededError();

  const sortOrder = await menuRepository.nextItemSortOrder(menuId, input.parentId);
  const item = await menuRepository.createItem({ menuId, sortOrder, ...input });
  await writeAuditLog({ actorId: adminUserId, action: "menu_item_added", module: "Navigation", targetType: "MenuItem", targetId: item.id, metadata: { menuId, location: menu.location } });
  return item;
}

export async function updateItem(adminUserId: string, menuId: string, itemId: string, input: Partial<MenuItemInput>) {
  await requirePermission(adminUserId, "Navigation", "Edit");
  const menu = await requireMenu(menuId);
  const existing = await requireItemInMenu(menuId, itemId);

  const linkType = input.linkType ?? existing.linkType;
  const internalPath = input.internalPath !== undefined ? input.internalPath : existing.internalPath;
  const externalUrl = input.externalUrl !== undefined ? input.externalUrl : existing.externalUrl;
  validateLinkTarget(linkType, internalPath, externalUrl);

  const contentBlockType = input.contentBlockType ?? existing.contentBlockType;
  if (contentBlockType === "PromoTile" && menu.location !== "Header") throw new InvalidContentBlockError();

  const updated = await menuRepository.updateItem(itemId, { ...input, linkType, internalPath, externalUrl });
  await writeAuditLog({ actorId: adminUserId, action: "menu_item_updated", module: "Navigation", targetType: "MenuItem", targetId: itemId, metadata: { menuId, location: menu.location } });
  return updated;
}

export async function removeItem(adminUserId: string, menuId: string, itemId: string): Promise<void> {
  await requirePermission(adminUserId, "Navigation", "Delete");
  const menu = await requireMenu(menuId);
  await requireItemInMenu(menuId, itemId);

  await menuRepository.deleteItemById(itemId);
  await writeAuditLog({ actorId: adminUserId, action: "menu_item_removed", module: "Navigation", targetType: "MenuItem", targetId: itemId, metadata: { menuId, location: menu.location } });
}

/** Reorders siblings in place (same parent) — pass the full ordered id list for that one container. */
export async function reorderItems(adminUserId: string, menuId: string, parentId: string | null, orderedItemIds: string[]): Promise<void> {
  await requirePermission(adminUserId, "Navigation", "Edit");
  await requireMenu(menuId);

  await menuRepository.reorderItems(menuId, parentId, orderedItemIds);
  await writeAuditLog({ actorId: adminUserId, action: "menu_items_reordered", module: "Navigation", targetType: "Menu", targetId: menuId });
}

/** Moves an item into a different container (reparenting), enforcing the per-location max-depth rule against its new position. */
export async function reparentItem(adminUserId: string, menuId: string, itemId: string, newParentId: string | null): Promise<void> {
  await requirePermission(adminUserId, "Navigation", "Edit");
  const menu = await requireMenu(menuId);
  await requireItemInMenu(menuId, itemId);
  if (newParentId) await requireItemInMenu(menuId, newParentId);

  const depth = await menuRepository.computeChildDepth(newParentId);
  if (depth > MAX_DEPTH_BY_LOCATION[menu.location]) throw new MaxDepthExceededError();

  const sortOrder = await menuRepository.nextItemSortOrder(menuId, newParentId);
  await menuRepository.reparentItem(itemId, newParentId, sortOrder);
  await writeAuditLog({ actorId: adminUserId, action: "menu_item_reparented", module: "Navigation", targetType: "MenuItem", targetId: itemId, metadata: { menuId, newParentId } });
}

// --- Publish / rollback ---

/** Atomic: publishing `id` archives whichever menu for the same location was previously live, in the same transaction — see menu.repository.ts::publishMenuSwappingPrevious. */
export async function publishMenu(adminUserId: string, id: string): Promise<MenuDetail> {
  await requirePermission(adminUserId, "Navigation", "Edit");
  const menu = await requireMenu(id);

  const published = await menuRepository.publishMenuSwappingPrevious(id, menu.location);
  await writeAuditLog({ actorId: adminUserId, action: "menu_published", module: "Navigation", targetType: "Menu", targetId: id, metadata: { location: menu.location } });
  return published;
}

/** One-level rollback: republishes the most-recently-Archived menu for this location via the same publish primitive — mirrors homepage-builder.service.ts's rollbackToPrevious. */
export async function rollbackMenu(adminUserId: string, location: MenuLocation): Promise<MenuDetail> {
  await requirePermission(adminUserId, "Navigation", "Edit");
  const target = await menuRepository.findMostRecentlyArchivedMenu(location);
  if (!target) throw new NoArchivedMenuError();

  const published = await menuRepository.publishMenuSwappingPrevious(target.id, location);
  await writeAuditLog({ actorId: adminUserId, action: "menu_rolled_back", module: "Navigation", targetType: "Menu", targetId: target.id, metadata: { location } });
  return published;
}

// --- Storefront-facing resolution ---
// Converts a published Menu's MenuItem tree into the exact shapes
// Header/Footer/MobileNav's presentational components already expect
// (NavItem, MegaMenuSection, FooterColumn) — until a location has ever
// been published, each falls back to nav-config.ts's/footer-config.ts's
// existing static arrays unchanged, so this is a zero-downtime addition,
// not a breaking cutover. The actual tree-walking lives in
// src/lib/menu-tree.ts (framework-agnostic, no Prisma import) so the
// admin preview pane can reuse the exact same mapping client-side —
// this file only supplies the real repository read and the fallback.

export async function getResolvedHeaderItems(): Promise<NavItem[]> {
  const menu = await menuRepository.findPublishedMenu("Header");
  if (!menu || menu.items.length === 0) return primaryNavItems;
  return mapHeaderNavItems(menu.items);
}

export async function getResolvedFooterColumns(): Promise<FooterColumn[]> {
  const menu = await menuRepository.findPublishedMenu("Footer");
  if (!menu || menu.items.length === 0) return footerColumns;
  return mapFooterColumns(menu.items);
}

export async function getResolvedMobileDrawerItems(): Promise<NavItem[]> {
  const menu = await menuRepository.findPublishedMenu("Mobile");
  if (!menu || menu.items.length === 0) return mobileDrawerItems;
  return mapFlatNavItems(menu.items);
}
