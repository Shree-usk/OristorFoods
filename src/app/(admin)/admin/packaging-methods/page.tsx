import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPackagingMethodsView } from "@/components/admin/products/admin-packaging-methods-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Packaging methods | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPackagingMethodsPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="Products" action="View">
      <AdminPackagingMethodsView />
    </RequirePermission>
  );
}
