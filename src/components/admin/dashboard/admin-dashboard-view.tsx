"use client";

import { useQuery } from "@tanstack/react-query";

import { ComingSoonCard } from "@/components/admin/dashboard/coming-soon-card";
import { ErpSyncCard } from "@/components/admin/dashboard/erp-sync-card";
import { ExportEnquiriesCard } from "@/components/admin/dashboard/export-enquiries-card";
import { FailedPaymentsCard } from "@/components/admin/dashboard/failed-payments-card";
import { LowStockCard } from "@/components/admin/dashboard/low-stock-card";
import { PendingModerationCard } from "@/components/admin/dashboard/pending-moderation-card";
import { PendingProductQaCard } from "@/components/admin/dashboard/pending-product-qa-card";
import { RevenueOrdersCard } from "@/components/admin/dashboard/revenue-orders-card";
import { RewardsReferralsCard } from "@/components/admin/dashboard/rewards-referrals-card";
import { SupportTicketsCard } from "@/components/admin/dashboard/support-tickets-card";
import { fetchDashboardSummary } from "@/lib/api/admin-dashboard-client";
import type { DashboardSummary } from "@/services/admin-dashboard.service";

/**
 * STORY-039. First refetchInterval usage in this codebase — AC #10 requires
 * auto-refreshing counts, no existing polling precedent to mirror instead.
 * `initialData` comes from the page's own Server Component call to
 * getDashboardSummary, so the first paint never shows a loading state.
 */
export function AdminDashboardView({ initialData }: { initialData: DashboardSummary }) {
  const { data } = useQuery({
    queryKey: ["admin-dashboard-summary"],
    queryFn: fetchDashboardSummary,
    initialData,
    refetchInterval: 60_000,
  });

  const summary = data ?? initialData;
  const hasAnyWidget =
    summary.revenueToday ||
    summary.pendingModeration ||
    summary.pendingProductQuestions ||
    summary.lowStock ||
    summary.rewardsReferrals ||
    summary.supportTickets ||
    summary.failedPayments ||
    summary.erpSyncStatus ||
    summary.exportEnquiryStatus ||
    summary.placeholders.liveVisitors ||
    summary.placeholders.systemHealth;

  return (
    <div>
      <h1 className="text-h2 font-heading text-charcoal">Dashboard</h1>
      {!hasAnyWidget ? (
        <p className="mt-6 text-body text-charcoal/70">Your role has no dashboard widgets to show.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {summary.revenueToday && <RevenueOrdersCard data={summary.revenueToday} />}
          {summary.pendingModeration && <PendingModerationCard data={summary.pendingModeration} />}
          {summary.pendingProductQuestions && <PendingProductQaCard data={summary.pendingProductQuestions} />}
          {summary.lowStock && <LowStockCard data={summary.lowStock} />}
          {summary.rewardsReferrals && <RewardsReferralsCard data={summary.rewardsReferrals} />}
          {summary.supportTickets && <SupportTicketsCard data={summary.supportTickets} />}
          {summary.failedPayments && <FailedPaymentsCard data={summary.failedPayments} />}
          {summary.erpSyncStatus && <ErpSyncCard data={summary.erpSyncStatus} />}
          {summary.exportEnquiryStatus && <ExportEnquiriesCard data={summary.exportEnquiryStatus} />}
          {summary.placeholders.liveVisitors && (
            <ComingSoonCard title="Live Visitors" note="storefront session tracking isn't built yet." />
          )}
          {summary.placeholders.systemHealth && (
            <ComingSoonCard title="System Health" note="uptime/error-rate monitoring hasn't been built yet." />
          )}
        </div>
      )}
    </div>
  );
}
