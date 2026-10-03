import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminCrmSegmentsView } from "@/components/admin/crm/admin-crm-segments-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "CRM Segments | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminCrmSegmentsPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="CRMAnalytics" action="View">
      <AdminCrmSegmentsView />
    </RequirePermission>
  );
}
