import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminSearchGlossaryView } from "@/components/admin/search/admin-search-glossary-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Search Glossary | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminSearchGlossaryPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="Products" action="View">
      <AdminSearchGlossaryView />
    </RequirePermission>
  );
}
