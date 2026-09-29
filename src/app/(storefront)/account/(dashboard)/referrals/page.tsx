import type { Metadata } from "next";
import Link from "next/link";

import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReferralLinkCard } from "@/components/storefront/account/referral-link-card";
import { ReferredFriendsList } from "@/components/storefront/account/referred-friends-list";
import { getReferralSummary, getReferredFriends } from "@/services/customer-referrals-dashboard.service";

export const metadata: Metadata = {
  title: "Referrals",
  robots: { index: false, follow: false },
};

/** STORY-035. Server Component — reads STORY-031's referral.service.ts directly (no Prisma access here, per the AC). */
export default async function ReferralsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [summary, friends] = await Promise.all([getReferralSummary(userId), getReferredFriends(userId)]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h2 font-heading text-charcoal">Referrals</h1>

      <div id="referral-link">
        <ReferralLinkCard link={summary.link} referrerBonusPoints={summary.referrerBonusPoints} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Referred friends</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-small text-charcoal/70">
            Total referral rewards earned:{" "}
            <Link href="/account/rewards" className="font-medium text-chilli underline-offset-2 hover:underline">
              {summary.totalPointsEarned.toLocaleString()} pts
            </Link>
          </p>
          <ReferredFriendsList friends={friends} />
        </CardContent>
      </Card>
    </div>
  );
}
