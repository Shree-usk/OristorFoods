import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminDashboardView } from "@/components/admin/dashboard/admin-dashboard-view";
import { adminAuth } from "@/lib/admin-auth";
import { getDashboardSummary } from "@/services/admin-dashboard.service";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  robots: { index: false, follow: false },
};

/**
 * STORY-039. Replaces STORY-038's placeholder landing page. (admin)/layout.tsx
 * already guarantees a resolved session before this renders; re-checked here
 * only because getDashboardSummary needs the admin user id, not to re-gate
 * access.
 */
export default async function AdminHomePage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  const initialData = await getDashboardSummary(session.user.id);
  return <AdminDashboardView initialData={initialData} />;
}
