import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminCertificationsView } from "@/components/admin/products/admin-certifications-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Allergens & Certifications | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminCertificationsPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="Products" action="View">
      <AdminCertificationsView />
    </RequirePermission>
  );
}
