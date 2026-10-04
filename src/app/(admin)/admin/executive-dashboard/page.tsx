import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminExecutiveDashboardView } from "@/components/admin/analytics/admin-executive-dashboard-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Executive Dashboard | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminExecutiveDashboardPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="CRMAnalytics" action="View">
      <AdminExecutiveDashboardView />
    </RequirePermission>
  );
}
