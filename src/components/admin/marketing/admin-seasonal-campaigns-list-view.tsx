"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchSeasonalCampaigns, type SeasonalCampaignStatusValue } from "@/lib/api/seasonal-campaign-admin-client";

const STATUS_VARIANT: Record<SeasonalCampaignStatusValue, "default" | "secondary" | "outline" | "destructive"> = {
  Draft: "outline",
  Scheduled: "secondary",
  Active: "default",
  Ended: "secondary",
  Archived: "destructive",
};

function linkedCount(campaign: { popupId: string | null; couponId: string | null; emailSmsCampaignId: string | null; homepageSectionId: string | null }): number {
  return [campaign.popupId, campaign.couponId, campaign.emailSmsCampaignId, campaign.homepageSectionId].filter(Boolean).length;
}

export function AdminSeasonalCampaignsListView() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-seasonal-campaigns"], queryFn: fetchSeasonalCampaigns });
  const campaigns = data?.campaigns ?? [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h2 font-heading text-charcoal">Seasonal Campaigns</h1>
          <p className="mt-1 text-small text-charcoal/70">Tie a coupon, a popup, a homepage section, and an email/SMS/WhatsApp send together under one named, date-ranged campaign.</p>
        </div>
        <Link href="/admin/marketing/seasonal-campaigns/new">
          <Button type="button">New campaign</Button>
        </Link>
      </div>

      <Table className="mt-6">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date range</TableHead>
            <TableHead>Linked items</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-charcoal/70">
                Loading…
              </TableCell>
            </TableRow>
          ) : campaigns.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-charcoal/70">
                No seasonal campaigns yet.
              </TableCell>
            </TableRow>
          ) : (
            campaigns.map((campaign) => (
              <TableRow key={campaign.id}>
                <TableCell>
                  <Link href={`/admin/marketing/seasonal-campaigns/${campaign.id}`} className="font-medium text-charcoal hover:underline">
                    {campaign.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[campaign.status]}>{campaign.status}</Badge>
                </TableCell>
                <TableCell>
                  {new Date(campaign.startDate).toLocaleDateString()} – {new Date(campaign.endDate).toLocaleDateString()}
                </TableCell>
                <TableCell>{linkedCount(campaign)} / 4</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
