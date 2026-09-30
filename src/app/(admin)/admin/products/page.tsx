import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminProductListView } from "@/components/admin/products/admin-product-list-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Products | Admin",
  robots: { index: false, follow: false },
};

/** STORY-040. First real admin content-management console module — list/filter/search/paginate/bulk-act. */
export default async function AdminProductsPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="Products" action="View">
      <AdminProductListView />
    </RequirePermission>
  );
}
