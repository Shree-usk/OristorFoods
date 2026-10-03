import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminNavigationView } from "@/components/admin/navigation/admin-navigation-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Navigation & Menus | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminNavigationPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="Navigation" action="View">
      <AdminNavigationView />
    </RequirePermission>
  );
}
