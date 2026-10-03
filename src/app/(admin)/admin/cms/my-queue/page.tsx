import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminReviewQueueView } from "@/components/admin/cms/admin-review-queue-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "My Review Queue | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminMyReviewQueuePage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="CMSWorkflow" action="View">
      <AdminReviewQueueView />
    </RequirePermission>
  );
}
