import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminReviewsQueueView } from "@/components/admin/reviews/admin-reviews-queue-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Reviews | Admin",
  robots: { index: false, follow: false },
};

/** STORY-045. Unified moderation queue for product reviews (STORY-015), recipe reviews (STORY-022), and blog comments (STORY-021/044). */
export default async function AdminReviewsPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="Reviews" action="View">
      <AdminReviewsQueueView />
    </RequirePermission>
  );
}
