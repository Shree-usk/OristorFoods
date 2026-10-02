import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminRewardsReferralsView } from "@/components/admin/rewards-referrals/admin-rewards-referrals-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Rewards & Referrals | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminRewardsReferralsPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="RewardsReferrals" action="View">
      <AdminRewardsReferralsView />
    </RequirePermission>
  );
}
