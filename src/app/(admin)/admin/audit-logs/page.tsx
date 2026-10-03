import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminAuditLogsView } from "@/components/admin/audit-logs/admin-audit-logs-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Audit Log | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminAuditLogsPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="UsersRolesAudit" action="Audit">
      <AdminAuditLogsView />
    </RequirePermission>
  );
}
