import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminCouponsView } from "@/components/admin/marketing/admin-coupons-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Coupons & Promotions | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminCouponsPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="Marketing" action="View">
      <AdminCouponsView />
    </RequirePermission>
  );
}
