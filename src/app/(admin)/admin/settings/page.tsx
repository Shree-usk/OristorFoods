import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AdminSettingsView } from "@/components/admin/settings/admin-settings-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "System Settings | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminSettingsPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="SystemSettings" action="View">
      <Suspense>
        <AdminSettingsView />
      </Suspense>
    </RequirePermission>
  );
}
