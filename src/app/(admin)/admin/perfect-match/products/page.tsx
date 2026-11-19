import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPerfectMatchProductsPageView } from "@/components/admin/perfect-match/admin-perfect-match-products-page-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Perfect Match Products | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPerfectMatchProductsPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="PerfectMatch" action="View">
      <AdminPerfectMatchProductsPageView />
    </RequirePermission>
  );
}
