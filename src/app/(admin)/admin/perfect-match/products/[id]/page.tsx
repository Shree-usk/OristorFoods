import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPerfectMatchProductDetailView } from "@/components/admin/perfect-match/admin-perfect-match-product-detail-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Manage Perfect Match Product | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPerfectMatchProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  const { id } = await params;

  return (
    <RequirePermission adminUserId={session.user.id} module="PerfectMatch" action="View">
      <AdminPerfectMatchProductDetailView productLinkId={id} />
    </RequirePermission>
  );
}
