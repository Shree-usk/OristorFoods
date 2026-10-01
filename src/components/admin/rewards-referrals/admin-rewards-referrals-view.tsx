"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminCampaignsPanel } from "@/components/admin/rewards-referrals/admin-campaigns-panel";
import { AdminPointRulesPanel } from "@/components/admin/rewards-referrals/admin-point-rules-panel";
import { AdminTiersBadgesPanel } from "@/components/admin/rewards-referrals/admin-tiers-badges-panel";
import { AdminReferralRulesPanel } from "@/components/admin/rewards-referrals/admin-referral-rules-panel";
import { AdminFraudQueuePanel } from "@/components/admin/rewards-referrals/admin-fraud-queue-panel";

export function AdminRewardsReferralsView() {
  return (
    <div>
      <h1 className="text-h2 font-heading text-charcoal">Rewards & Referrals</h1>
      <p className="mt-1 text-small text-charcoal/70">Campaigns, point rules, tiers & badges, referral rules, and fraud monitoring.</p>

      <Tabs defaultValue="campaigns" className="mt-6">
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="point-rules">Point Rules</TabsTrigger>
          <TabsTrigger value="tiers-badges">Tiers & Badges</TabsTrigger>
          <TabsTrigger value="referral-rules">Referral Rules</TabsTrigger>
          <TabsTrigger value="fraud-queue">Fraud Queue</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          <AdminCampaignsPanel />
        </TabsContent>
        <TabsContent value="point-rules">
          <AdminPointRulesPanel />
        </TabsContent>
        <TabsContent value="tiers-badges">
          <AdminTiersBadgesPanel />
        </TabsContent>
        <TabsContent value="referral-rules">
          <AdminReferralRulesPanel />
        </TabsContent>
        <TabsContent value="fraud-queue">
          <AdminFraudQueuePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
