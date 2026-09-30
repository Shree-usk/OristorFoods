import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RewardsReferralsCard({ data }: { data: { redemptions: number; referralSignups: number } }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rewards &amp; Referrals</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-small text-charcoal/70">
          <span className="text-h4 font-heading text-charcoal">{data.redemptions}</span> redemption{data.redemptions === 1 ? "" : "s"} today
        </p>
        <p className="mt-1 text-small text-charcoal/70">
          <span className="text-h4 font-heading text-charcoal">{data.referralSignups}</span> referral signup{data.referralSignups === 1 ? "" : "s"} today
        </p>
      </CardContent>
    </Card>
  );
}
