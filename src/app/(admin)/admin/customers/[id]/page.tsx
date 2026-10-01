import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminCustomerDetailView } from "@/components/admin/customers/admin-customer-detail-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Customer | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  const { id } = await params;

  return (
    <RequirePermission adminUserId={session.user.id} module="Customers" action="View">
      <AdminCustomerDetailView customerId={id} />
    </RequirePermission>
  );
}
