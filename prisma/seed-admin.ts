import bcrypt from "bcryptjs";

import { prisma } from "../src/lib/db";
import type { AdminAction, AdminModule } from "../src/generated/prisma/client";

/**
 * Admin Auth & RBAC seed (STORY-038 — core scope). Seeds the 12 roles from
 * blueprint.md Section 7 and a documented default permission matrix, plus
 * one initial Super Administrator account (this pass has no self-service
 * invite flow — see docs/architecture-decisions.md).
 *
 * Default matrix (also documented in docs/architecture-decisions.md):
 * Super Administrator gets every action on every module (the AC's
 * "cannot be reduced below full access" floor). Administrator gets every
 * action except Audit on every module — Audit (viewing a module's audit
 * trail) is reserved to Super Administrator only, everywhere, a
 * deliberate simplification avoiding a per-role judgment call blueprint.md
 * doesn't specify. Every other role gets the full action set on its own
 * "home" modules and View-only everywhere else. Viewer gets View-only
 * everywhere, nothing else.
 */

const ALL_MODULES: AdminModule[] = [
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
  "ContactEnquiries",
  "StoryPages",
];

const ALL_ACTIONS: AdminAction[] = ["View", "Edit", "Delete", "Approve", "Export", "Audit"];
const HOME_ACTIONS: AdminAction[] = ["View", "Edit", "Delete", "Approve", "Export"];

interface RoleSeed {
  key: string;
  name: string;
  superAdmin?: boolean;
  fullAccess?: boolean;
  homeModules?: AdminModule[];
}

const ROLE_SEEDS: RoleSeed[] = [
  { key: "super_administrator", name: "Super Administrator", superAdmin: true },
  { key: "administrator", name: "Administrator", fullAccess: true },
  { key: "marketing_manager", name: "Marketing Manager", homeModules: ["Marketing", "HomepageBuilder", "SEO"] },
  { key: "sales_manager", name: "Sales Manager", homeModules: ["Orders", "Customers", "RewardsReferrals"] },
  { key: "finance_manager", name: "Finance Manager", homeModules: ["Orders", "ExportPortal", "SystemSettings"] },
  { key: "production_manager", name: "Production Manager", homeModules: ["Products", "MediaLibrary"] },
  { key: "warehouse_manager", name: "Warehouse Manager", homeModules: ["Orders", "DeliveryZones", "ERPIntegration"] },
  { key: "customer_support", name: "Customer Support", homeModules: ["Customers", "Orders", "Reviews", "QA", "ContactEnquiries"] },
  { key: "export_manager", name: "Export Manager", homeModules: ["ExportPortal", "Orders", "CRMAnalytics"] },
  { key: "content_editor", name: "Content Editor", homeModules: ["Blog", "Recipes", "Navigation", "CMSWorkflow", "StoryPages"] },
  { key: "seo_specialist", name: "SEO Specialist", homeModules: ["SEO", "Navigation"] },
  { key: "viewer", name: "Viewer" },
];

function buildPermissionRows(roleId: string, seed: RoleSeed): Array<{ roleId: string; module: AdminModule; action: AdminAction }> {
  const rows: Array<{ roleId: string; module: AdminModule; action: AdminAction }> = [];

  for (const adminModule of ALL_MODULES) {
    const actions = seed.superAdmin
      ? ALL_ACTIONS
      : seed.fullAccess
        ? HOME_ACTIONS
        : seed.homeModules?.includes(adminModule)
          ? HOME_ACTIONS
          : (["View"] as AdminAction[]);
    for (const action of actions) rows.push({ roleId, module: adminModule, action });
  }

  return rows;
}

export async function seedAdmin() {
  const roles = new Map<string, string>();

  for (const seed of ROLE_SEEDS) {
    const role = await prisma.role.create({ data: { key: seed.key, name: seed.name } });
    roles.set(seed.key, role.id);
    await prisma.rolePermission.createMany({ data: buildPermissionRows(role.id, seed) });
  }

  // Dev-only initial account — this pass has no self-service invite flow.
  // Override via env before seeding a shared environment; never rely on
  // the fallback outside local development.
  const email = process.env.ADMIN_SEED_EMAIL ?? "admin@oristor.com";
  const password = process.env.ADMIN_SEED_PASSWORD ?? "ChangeMe123!";
  if (!process.env.ADMIN_SEED_PASSWORD) {
    console.warn(`[seed-admin] ADMIN_SEED_PASSWORD not set — using the dev-only default. Do not use this outside local development.`);
  }

  const superAdministratorRoleId = roles.get("super_administrator");
  if (!superAdministratorRoleId) throw new Error("super_administrator role was not seeded");

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.adminUser.create({
    data: { email, name: "Super Admin", passwordHash, roleId: superAdministratorRoleId },
  });

  return { roles: ROLE_SEEDS.length, initialSuperAdministrator: email };
}
