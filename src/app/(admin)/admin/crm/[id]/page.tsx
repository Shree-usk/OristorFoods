import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminSegmentBuilderView } from "@/components/admin/crm/admin-segment-builder-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Edit Segment | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminEditCrmSegmentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  const { id } = await params;

  return (
    <RequirePermission adminUserId={session.user.id} module="CRMAnalytics" action="Edit">
      <AdminSegmentBuilderView segmentId={id} />
    </RequirePermission>
  );
}
