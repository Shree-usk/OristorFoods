import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPerfectMatchView } from "@/components/admin/perfect-match/admin-perfect-match-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "The Perfect Match | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminPerfectMatchPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="PerfectMatch" action="View">
      <AdminPerfectMatchView />
    </RequirePermission>
  );
}
