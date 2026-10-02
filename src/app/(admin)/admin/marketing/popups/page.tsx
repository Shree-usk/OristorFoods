import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPopupsListView } from "@/components/admin/marketing/admin-popups-list-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Promotional Pop-ups | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPopupsPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="Marketing" action="View">
      <AdminPopupsListView />
    </RequirePermission>
  );
}
