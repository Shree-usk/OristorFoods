import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminOrdersListView } from "@/components/admin/orders/admin-orders-list-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Orders | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminOrdersPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="Orders" action="View">
      <AdminOrdersListView />
    </RequirePermission>
  );
}
