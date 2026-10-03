import type { MenuContentBlockType, MenuItemVisibility, MenuLinkType, MenuLocation, Prisma } from "@/generated/prisma/client";
import type { CustomerGroup } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** STORY-052. The only place Menu/MenuItem are queried/mutated. */

const withItems = {
  items: { orderBy: { sortOrder: "asc" } },
} satisfies Prisma.MenuInclude;

export type MenuDetail = Prisma.MenuGetPayload<{ include: typeof withItems }>;
export type MenuItemRow = MenuDetail["items"][number];

export function createMenu(data: Prisma.MenuCreateInput): Promise<MenuDetail> {
  return prisma.menu.create({ data, include: withItems });
}

export function findMenuById(id: string): Promise<MenuDetail | null> {
  return prisma.menu.findUnique({ where: { id }, include: withItems });
}

export function findDraftMenu(location: MenuLocation): Promise<MenuDetail | null> {
  return prisma.menu.findFirst({ where: { location, status: "Draft" }, include: withItems });
}

/** Storefront-facing read — the currently-live menu for this location, or null before anything's ever been published. */
export function findPublishedMenu(location: MenuLocation): Promise<MenuDetail | null> {
  return prisma.menu.findFirst({ where: { location, status: "Published" }, include: withItems });
}

/** The most-recently-published menu for this location that's since been superseded — the one-level rollback target. */
export function findMostRecentlyArchivedMenu(location: MenuLocation): Promise<MenuDetail | null> {
  return prisma.menu.findFirst({ where: { location, status: "Archived" }, orderBy: { updatedAt: "desc" }, include: withItems });
}

/**
 * Publishes `id` and, if a different menu for the same location is
 * currently Published, archives it in the same transaction — an atomic
 * swap scoped by location, so publishing Header never touches Footer's
 * or Mobile's published state.
 */
export function publishMenuSwappingPrevious(id: string, location: MenuLocation) {
  return prisma.$transaction(async (tx) => {
    const currentlyPublished = await tx.menu.findFirst({ where: { location, status: "Published", id: { not: id } } });
    if (currentlyPublished) {
      await tx.menu.update({ where: { id: currentlyPublished.id }, data: { status: "Archived" } });
    }
    return tx.menu.update({
      where: { id },
      data: { status: "Published", publishedAt: new Date() },
      include: withItems,
    });
  });
}

export function updateMenuAuditFields(id: string, updatedById: string) {
  return prisma.menu.update({ where: { id }, data: { updatedById } });
}

export function findItemById(id: string) {
  return prisma.menuItem.findUnique({ where: { id } });
}

/** Walks the parent chain to find the depth a new child of `parentId` would have (0 for a top-level item, i.e. parentId null). */
export async function computeChildDepth(parentId: string | null): Promise<number> {
  if (!parentId) return 0;
  let depth = 1;
  let currentId: string | null = parentId;
  for (let guard = 0; guard < 10 && currentId; guard += 1) {
    const node: { parentId: string | null } | null = await prisma.menuItem.findUnique({ where: { id: currentId }, select: { parentId: true } });
    if (!node?.parentId) break;
    depth += 1;
    currentId = node.parentId;
  }
  return depth;
}

export interface CreateItemInput {
  menuId: string;
  parentId: string | null;
  sortOrder: number;
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

export function createItem(input: CreateItemInput) {
  return prisma.menuItem.create({
    data: {
      menu: { connect: { id: input.menuId } },
      parent: input.parentId ? { connect: { id: input.parentId } } : undefined,
      sortOrder: input.sortOrder,
      label: input.label,
      linkType: input.linkType,
      internalPath: input.internalPath,
      externalUrl: input.externalUrl,
      openInNewTab: input.openInNewTab,
      icon: input.icon,
      visibility: input.visibility,
      targetCustomerGroup: input.targetCustomerGroup,
      active: input.active,
      contentBlockType: input.contentBlockType,
      promoImageUrl: input.promoImageUrl,
      promoImageAlt: input.promoImageAlt,
      promoHeading: input.promoHeading,
      promoCtaLabel: input.promoCtaLabel,
    },
  });
}

export type UpdateItemInput = Partial<Omit<CreateItemInput, "menuId" | "parentId" | "sortOrder">>;

export function updateItem(id: string, input: UpdateItemInput) {
  return prisma.menuItem.update({ where: { id }, data: input });
}

export function deleteItemById(id: string) {
  // children cascade via the schema's onDelete: Cascade on MenuItem.parent.
  return prisma.menuItem.delete({ where: { id } });
}

export async function nextItemSortOrder(menuId: string, parentId: string | null): Promise<number> {
  const last = await prisma.menuItem.findFirst({ where: { menuId, parentId }, orderBy: { sortOrder: "desc" } });
  return (last?.sortOrder ?? -1) + 1;
}

/**
 * Rewrites every sibling's sortOrder to match `orderedIds`'s position — a
 * single transaction so the list is never half-reordered. Scoped by
 * (menuId, parentId) since siblings are grouped by their shared parent,
 * not just by menu.
 */
export function reorderItems(menuId: string, parentId: string | null, orderedIds: string[]) {
  return prisma.$transaction(orderedIds.map((id, index) => prisma.menuItem.updateMany({ where: { id, menuId, parentId }, data: { sortOrder: index } })));
}

/** Moves an item to a different parent (or to top-level, if null) and gives it the next sortOrder in its new container. */
export function reparentItem(id: string, newParentId: string | null, sortOrder: number) {
  return prisma.menuItem.update({ where: { id }, data: { parentId: newParentId, sortOrder } });
}
