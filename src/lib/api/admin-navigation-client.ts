/** STORY-052. Fetch wrappers for /api/admin/navigation/* — mirrors admin-homepage-builder-client.ts's assertOk convention. */

function assertOk(response: Response, message: string): void {
  if (!response.ok) throw new Error(`${message} (${response.status})`);
}

export type MenuLocationValue = "Header" | "Footer" | "Mobile";
export type MenuStatusValue = "Draft" | "Published" | "Archived";
export type MenuLinkTypeValue = "None" | "Internal" | "External";
export type MenuItemVisibilityValue = "Always" | "Authenticated" | "CustomerGroupTarget";
export type MenuContentBlockTypeValue = "Link" | "PromoTile";
export type CustomerGroupValue = "Retail" | "Wholesale" | "Distributor" | "Export" | "PrivateLabel";

export interface MenuItem {
  id: string;
  menuId: string;
  parentId: string | null;
  sortOrder: number;
  label: string;
  linkType: MenuLinkTypeValue;
  internalPath: string | null;
  externalUrl: string | null;
  openInNewTab: boolean;
  icon: string | null;
  visibility: MenuItemVisibilityValue;
  targetCustomerGroup: CustomerGroupValue | null;
  active: boolean;
  contentBlockType: MenuContentBlockTypeValue;
  promoImageUrl: string | null;
  promoImageAlt: string | null;
  promoHeading: string | null;
  promoCtaLabel: string | null;
}

export interface Menu {
  id: string;
  location: MenuLocationValue;
  status: MenuStatusValue;
  publishedAt: string | null;
  items: MenuItem[];
}

export interface MenuItemInput {
  parentId: string | null;
  label: string;
  linkType: MenuLinkTypeValue;
  internalPath: string | null;
  externalUrl: string | null;
  openInNewTab: boolean;
  icon: string | null;
  visibility: MenuItemVisibilityValue;
  targetCustomerGroup: CustomerGroupValue | null;
  active: boolean;
  contentBlockType: MenuContentBlockTypeValue;
  promoImageUrl: string | null;
  promoImageAlt: string | null;
  promoHeading: string | null;
  promoCtaLabel: string | null;
}

export async function fetchMenus(location: MenuLocationValue): Promise<{ draft: Menu; published: Menu | null }> {
  const response = await fetch(`/api/admin/navigation/menus/${location}`);
  assertOk(response, "Failed to load menus");
  return response.json();
}

export async function createMenuItem(location: MenuLocationValue, input: MenuItemInput): Promise<MenuItem> {
  const response = await fetch(`/api/admin/navigation/menus/${location}/items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  assertOk(response, "Failed to add the menu item");
  return response.json();
}

export async function updateMenuItem(location: MenuLocationValue, itemId: string, input: Partial<MenuItemInput>): Promise<MenuItem> {
  const response = await fetch(`/api/admin/navigation/menus/${location}/items/${itemId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  assertOk(response, "Failed to update the menu item");
  return response.json();
}

export async function deleteMenuItem(location: MenuLocationValue, itemId: string): Promise<void> {
  const response = await fetch(`/api/admin/navigation/menus/${location}/items/${itemId}`, { method: "DELETE" });
  assertOk(response, "Failed to remove the menu item");
}

export async function reorderMenuItems(location: MenuLocationValue, parentId: string | null, orderedItemIds: string[]): Promise<void> {
  const response = await fetch(`/api/admin/navigation/menus/${location}/items/reorder`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ parentId, orderedItemIds }) });
  assertOk(response, "Failed to reorder menu items");
}

export async function reparentMenuItem(location: MenuLocationValue, itemId: string, newParentId: string | null): Promise<void> {
  const response = await fetch(`/api/admin/navigation/menus/${location}/items/${itemId}/reparent`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newParentId }) });
  assertOk(response, "Failed to move the menu item");
}

export async function publishMenu(location: MenuLocationValue): Promise<Menu> {
  const response = await fetch(`/api/admin/navigation/menus/${location}/publish`, { method: "POST" });
  assertOk(response, "Failed to publish this menu");
  return response.json();
}

export async function rollbackMenu(location: MenuLocationValue): Promise<Menu> {
  const response = await fetch(`/api/admin/navigation/menus/${location}/rollback`, { method: "POST" });
  assertOk(response, "Failed to roll back this menu");
  return response.json();
}

export interface LinkCheckResult {
  itemId: string;
  label: string;
  ok: boolean;
  reason?: string;
}

export async function checkMenuLinks(menuId: string): Promise<LinkCheckResult[]> {
  const response = await fetch("/api/admin/navigation/link-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ menuId }) });
  assertOk(response, "Failed to check links");
  const data = await response.json();
  return data.results;
}
