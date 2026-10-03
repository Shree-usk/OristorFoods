import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminSeoPagesListView } from "@/components/admin/seo/admin-seo-pages-list-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "SEO Pages | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminSeoPagesPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="SEO" action="View">
      <AdminSeoPagesListView />
    </RequirePermission>
  );
}
