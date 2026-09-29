import { Badge } from "@/components/ui/badge";
import { DashboardEmptyState } from "@/components/storefront/account/dashboard-empty-state";
import type { ReferredFriend } from "@/services/customer-referrals-dashboard.service";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-LK", { dateStyle: "medium" });
}

/** STORY-035. Plain presentational list — no pagination needed per the AC (a customer's referral count is small by nature). */
export function ReferredFriendsList({ friends }: { friends: ReferredFriend[] }) {
  if (friends.length === 0) {
    return <DashboardEmptyState message="You haven't referred anyone yet" ctaLabel="Share your link" ctaHref="#referral-link" />;
  }

  return (
    <ul className="flex flex-col divide-y divide-input">
      {friends.map((friend, index) => (
        <li key={`${friend.createdAt}-${index}`} className="flex items-center justify-between gap-4 py-3">
          <div>
            <p className="font-medium text-charcoal">
              {friend.displayName}
              {friend.maskedEmail && <span className="ml-1 font-normal text-charcoal/70">({friend.maskedEmail})</span>}
            </p>
            <p className="text-caption text-charcoal/70">Joined {formatDate(friend.createdAt)}</p>
          </div>
          <Badge variant={friend.status === "Reward Earned" ? "secondary" : "outline"}>{friend.status}</Badge>
        </li>
      ))}
    </ul>
  );
}
