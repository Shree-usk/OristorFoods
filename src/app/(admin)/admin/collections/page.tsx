import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminCollectionsView } from "@/components/admin/collections/admin-collections-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Collections | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminCollectionsPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="Products" action="View">
      <AdminCollectionsView />
    </RequirePermission>
  );
}
