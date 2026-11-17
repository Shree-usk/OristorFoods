import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminExportPageContentView } from "@/components/admin/export/admin-export-page-content-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Export Page Content | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminExportPageContentPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="ExportPortal" action="View">
      <AdminExportPageContentView />
    </RequirePermission>
  );
}
