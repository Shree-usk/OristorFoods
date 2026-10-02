import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminSeasonalCampaignEditorView } from "@/components/admin/marketing/admin-seasonal-campaign-editor-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Edit Seasonal Campaign | Admin",
  robots: { index: false, follow: false },
};

export default async function EditAdminSeasonalCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  const { id } = await params;

  return (
    <RequirePermission adminUserId={session.user.id} module="Marketing" action="View">
      <AdminSeasonalCampaignEditorView campaignId={id} />
    </RequirePermission>
  );
}
