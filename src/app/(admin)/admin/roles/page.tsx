import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminRolesView } from "@/components/admin/roles/admin-roles-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Roles | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminRolesPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="UsersRolesAudit" action="View">
      <AdminRolesView />
    </RequirePermission>
  );
}
