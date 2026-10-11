import { describe, expect, it } from "vitest";

import { ADMIN_NAV_GROUPS, ADMIN_QUICK_ADD_LINKS, filterAdminNavByPermissions } from "@/lib/admin-nav-registry";

describe("filterAdminNavByPermissions", () => {
  it("returns everything for an admin granted every permission the registry uses", () => {
    const allKeys = new Set<string>();
    for (const link of ADMIN_QUICK_ADD_LINKS) allKeys.add(`${link.module}:${link.action}`);
    for (const group of ADMIN_NAV_GROUPS) for (const link of group.links) allKeys.add(`${link.module}:${link.action}`);

    const result = filterAdminNavByPermissions(allKeys, ADMIN_QUICK_ADD_LINKS, ADMIN_NAV_GROUPS);
    expect(result.quickAdd).toHaveLength(ADMIN_QUICK_ADD_LINKS.length);
    expect(result.groups).toHaveLength(ADMIN_NAV_GROUPS.length);
    for (const group of result.groups) expect(group.links.length).toBeGreaterThan(0);
  });

  it("returns nothing for an admin with zero permissions", () => {
    const result = filterAdminNavByPermissions(new Set(), ADMIN_QUICK_ADD_LINKS, ADMIN_NAV_GROUPS);
    expect(result.quickAdd).toHaveLength(0);
    expect(result.groups).toHaveLength(0);
  });

  it("drops a group entirely once its only matching link's permission is removed", () => {
    const quickAdd = [{ label: "Thing", href: "/admin/thing/new", module: "Products" as const, action: "Edit" as const }];
    const groups = [{ title: "Solo Group", links: [{ label: "Thing", href: "/admin/thing", module: "Products" as const, action: "View" as const }] }];

    const withAccess = filterAdminNavByPermissions(new Set(["Products:View"]), quickAdd, groups);
    expect(withAccess.groups).toHaveLength(1);

    const withoutAccess = filterAdminNavByPermissions(new Set(["Orders:View"]), quickAdd, groups);
    expect(withoutAccess.groups).toHaveLength(0);
    expect(withoutAccess.quickAdd).toHaveLength(0);
  });

  it("shows Audit logs only to an admin with the Audit action, not just View", () => {
    const auditGroup = ADMIN_NAV_GROUPS.find((group) => group.title === "System");
    expect(auditGroup).toBeDefined();
    const auditLink = auditGroup!.links.find((link) => link.label === "Audit logs");
    expect(auditLink).toBeDefined();
    expect(auditLink!.action).toBe("Audit");

    const viewOnly = filterAdminNavByPermissions(new Set(["UsersRolesAudit:View"]), [], ADMIN_NAV_GROUPS);
    const systemGroupViewOnly = viewOnly.groups.find((group) => group.title === "System");
    expect(systemGroupViewOnly?.links.some((link) => link.label === "Audit logs")).toBe(false);

    const withAudit = filterAdminNavByPermissions(new Set(["UsersRolesAudit:View", "UsersRolesAudit:Audit"]), [], ADMIN_NAV_GROUPS);
    const systemGroupWithAudit = withAudit.groups.find((group) => group.title === "System");
    expect(systemGroupWithAudit?.links.some((link) => link.label === "Audit logs")).toBe(true);
  });
});
