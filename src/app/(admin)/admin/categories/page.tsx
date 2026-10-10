import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminCategoriesView } from "@/components/admin/categories/admin-categories-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Categories | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminCategoriesPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="Products" action="View">
      <AdminCategoriesView />
    </RequirePermission>
  );
}
