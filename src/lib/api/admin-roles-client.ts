/** STORY-057. Fetch wrappers for /api/admin/roles/*. */

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export type AdminModuleValue =
  | "Products"
  | "MediaLibrary"
  | "HomepageBuilder"
  | "Recipes"
  | "Blog"
  | "Reviews"
  | "QA"
  | "Orders"
  | "Customers"
  | "RewardsReferrals"
  | "Marketing"
  | "SEO"
  | "Navigation"
  | "CMSWorkflow"
  | "SystemSettings"
  | "DeliveryZones"
  | "ERPIntegration"
  | "UsersRolesAudit"
  | "ExportPortal"
  | "CRMAnalytics";

export type AdminActionValue = "View" | "Edit" | "Delete" | "Approve" | "Export" | "Audit";

export const ADMIN_MODULES: AdminModuleValue[] = [
  "Products",
  "MediaLibrary",
  "HomepageBuilder",
  "Recipes",
  "Blog",
  "Reviews",
  "QA",
  "Orders",
  "Customers",
  "RewardsReferrals",
  "Marketing",
  "SEO",
  "Navigation",
  "CMSWorkflow",
  "SystemSettings",
  "DeliveryZones",
  "ERPIntegration",
  "UsersRolesAudit",
  "ExportPortal",
  "CRMAnalytics",
];

export const ADMIN_ACTIONS: AdminActionValue[] = ["View", "Edit", "Delete", "Approve", "Export", "Audit"];

export interface RolePermissionRow {
  id: string;
  roleId: string;
  module: AdminModuleValue;
  action: AdminActionValue;
}

export interface RoleWithPermissions {
  id: string;
  key: string;
  name: string;
  permissions: RolePermissionRow[];
}

export async function fetchRoles(): Promise<RoleWithPermissions[]> {
  const response = await fetch("/api/admin/roles");
  if (!response.ok) throw new Error(`Failed to load roles (${response.status})`);
  return response.json();
}

export interface PermissionEntryInput {
  module: AdminModuleValue;
  action: AdminActionValue;
  granted: boolean;
}

export async function updateRolePermissions(roleId: string, entries: PermissionEntryInput[]): Promise<RolePermissionRow[]> {
  const response = await fetch(`/api/admin/roles/${roleId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entries }) });
  await assertOkWithServerMessage(response, "Failed to save the permission matrix");
  return response.json();
}

export async function cloneRole(input: { sourceRoleId: string; newKey: string; newName: string }): Promise<{ id: string; key: string; name: string }> {
  const response = await fetch("/api/admin/roles/clone", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to clone the role");
  return response.json();
}
