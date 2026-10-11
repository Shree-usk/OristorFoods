import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminDashboardView } from "@/components/admin/dashboard/admin-dashboard-view";
import { AdminQuickLinks } from "@/components/admin/dashboard/admin-quick-links";
import { adminAuth } from "@/lib/admin-auth";
import { ADMIN_NAV_GROUPS, ADMIN_QUICK_ADD_LINKS, filterAdminNavByPermissions } from "@/lib/admin-nav-registry";
import { getDashboardSummary } from "@/services/admin-dashboard.service";
import { getPermissionsForAdminUser } from "@/services/permission.service";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  robots: { index: false, follow: false },
};

/**
 * STORY-039. Replaces STORY-038's placeholder landing page. (admin)/layout.tsx
 * already guarantees a resolved session before this renders; re-checked here
 * only because getDashboardSummary needs the admin user id, not to re-gate
 * access.
 *
 * Quick Links: the dashboard itself only ever surfaced KPI widgets, never
 * links into the modules those numbers are about — (admin)/layout.tsx is
 * deliberately a minimal top bar with no sidebar/nav anywhere. Every link
 * here is filtered server-side against the admin's real permission set
 * (getPermissionsForAdminUser, the same single-read primitive
 * getDashboardSummary already uses), never just visually hidden.
 */
export default async function AdminHomePage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  const [initialData, permissions] = await Promise.all([getDashboardSummary(session.user.id), getPermissionsForAdminUser(session.user.id)]);
  const { quickAdd, groups } = filterAdminNavByPermissions(permissions, ADMIN_QUICK_ADD_LINKS, ADMIN_NAV_GROUPS);

  return (
    <div className="flex flex-col gap-10">
      <AdminQuickLinks quickAdd={quickAdd} groups={groups} />
      <AdminDashboardView initialData={initialData} />
    </div>
  );
}
