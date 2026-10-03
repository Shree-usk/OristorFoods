import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminDistributorAccountsView } from "@/components/admin/export/admin-distributor-accounts-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Distributor Accounts | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminDistributorAccountsPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="ExportPortal" action="View">
      <AdminDistributorAccountsView />
    </RequirePermission>
  );
}
