import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminSeasonalCampaignsListView } from "@/components/admin/marketing/admin-seasonal-campaigns-list-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Seasonal Campaigns | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminSeasonalCampaignsPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="Marketing" action="View">
      <AdminSeasonalCampaignsListView />
    </RequirePermission>
  );
}
