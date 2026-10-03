import { z } from "zod";

export const ADMIN_MODULES = [
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
] as const;

const ADMIN_ACTIONS = ["View", "Edit", "Delete", "Approve", "Export", "Audit"] as const;

export const permissionEntrySchema = z.object({
  module: z.enum(ADMIN_MODULES),
  action: z.enum(ADMIN_ACTIONS),
  granted: z.boolean(),
});

export const updateRolePermissionsSchema = z.object({
  entries: z.array(permissionEntrySchema),
});

export const cloneRoleSchema = z.object({
  sourceRoleId: z.string().trim().min(1, "Source role is required."),
  newKey: z
    .string()
    .trim()
    .min(1, "Role key is required.")
    .max(60)
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers, and underscores only."),
  newName: z.string().trim().min(1, "Role name is required.").max(100),
});
