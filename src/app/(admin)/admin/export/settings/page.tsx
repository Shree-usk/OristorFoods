import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminExportCatalogueSettingsPanel } from "@/components/admin/export/admin-export-catalogue-settings-panel";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Export Catalogue Settings | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminExportCatalogueSettingsPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="ExportPortal" action="Edit">
      <AdminExportCatalogueSettingsPanel />
    </RequirePermission>
  );
}
