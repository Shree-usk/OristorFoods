import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminLandingPagesListView } from "@/components/admin/marketing/admin-landing-pages-list-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Landing Pages | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLandingPagesPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="Marketing" action="View">
      <AdminLandingPagesListView />
    </RequirePermission>
  );
}
