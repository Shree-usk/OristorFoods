import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminErpIntegrationView } from "@/components/admin/erp-integration/admin-erp-integration-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "ERP Integration | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminErpIntegrationPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="ERPIntegration" action="View">
      <AdminErpIntegrationView />
    </RequirePermission>
  );
}
