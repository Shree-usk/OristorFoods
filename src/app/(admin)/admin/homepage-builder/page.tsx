import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { HomepageBuilderListView } from "@/components/admin/homepage-builder/homepage-builder-list-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Homepage Builder | Admin",
  robots: { index: false, follow: false },
};

/** STORY-042. The admin-side authoring tool for the storefront homepage (STORY-006). */
export default async function AdminHomepageBuilderPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="HomepageBuilder" action="View">
      <HomepageBuilderListView />
    </RequirePermission>
  );
}
