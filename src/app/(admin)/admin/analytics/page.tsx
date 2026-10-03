import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminAnalyticsView } from "@/components/admin/analytics/admin-analytics-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Analytics | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminAnalyticsPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="CRMAnalytics" action="View">
      <AdminAnalyticsView />
    </RequirePermission>
  );
}
