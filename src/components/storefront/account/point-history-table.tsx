"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { DashboardEmptyState } from "@/components/storefront/account/dashboard-empty-state";
import type { PointHistoryPage, PointHistoryRow } from "@/services/customer-rewards-dashboard.service";

const TYPE_LABELS: Record<PointHistoryRow["type"], string> = {
  Earned: "Order placed",
  Redeemed: "Points redeemed",
  Reversed: "Order cancelled",
  Expired: "Points expired",
  ReferralBonus: "Referral reward",
  ReferralBonusReversed: "Referral reward reversed",
  ReferralWelcomeBonus: "Welcome bonus",
};

const PAGE_SIZE = 20;

async function fetchPage(page: number): Promise<PointHistoryPage> {
  const response = await fetch(`/api/account/rewards/history?page=${page}&pageSize=${PAGE_SIZE}`, { credentials: "include" });
  if (!response.ok) throw new Error("Failed to load your point history");
  return response.json() as Promise<PointHistoryPage>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-LK", { dateStyle: "medium" });
}

/** STORY-035. Client-paginated beyond the server-rendered first page (`initialData`) — see customer-rewards-dashboard.service.ts for the running-balance computation. */
export function PointHistoryTable({ initialData }: { initialData: PointHistoryPage }) {
  const [page, setPage] = useState(1);
  const { data } = useQuery({
    queryKey: ["reward-point-history", page],
    queryFn: () => fetchPage(page),
    initialData: page === 1 ? initialData : undefined,
    placeholderData: (previous) => previous,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (rows.length === 0) {
    return <DashboardEmptyState message="You haven't earned any points yet" ctaLabel="Shop Now" ctaHref="/products" />;
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-small">
          <thead>
            <tr className="border-b border-input text-charcoal/70">
              <th className="py-2 pr-4 font-medium">Date</th>
              <th className="py-2 pr-4 font-medium">Description</th>
              <th className="py-2 pr-4 text-right font-medium">Points</th>
              <th className="py-2 pr-4 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-input/60">
                <td className="py-2 pr-4 whitespace-nowrap text-charcoal/70">{formatDate(row.createdAt)}</td>
                <td className="py-2 pr-4 text-charcoal">{TYPE_LABELS[row.type] ?? row.type}</td>
                <td className={`py-2 pr-4 text-right font-number ${row.points >= 0 ? "text-leaf-dark" : "text-destructive"}`}>
                  {row.points >= 0 ? "+" : ""}
                  {row.points.toLocaleString()}
                </td>
                <td className="py-2 pr-4 text-right font-number text-charcoal">{row.balanceAfter.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between text-small">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-charcoal/70">
            Page {page} of {pageCount}
          </span>
          <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
