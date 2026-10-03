import * as blogRepository from "@/repositories/blog.repository";
import * as exportEnquiryRepository from "@/repositories/export-enquiry.repository";
import * as orderRepository from "@/repositories/order.repository";
import * as paymentRepository from "@/repositories/payment.repository";
import * as productRepository from "@/repositories/product.repository";
import * as qaRepository from "@/repositories/qa.repository";
import * as recipeReviewRepository from "@/repositories/recipe-review.repository";
import * as referralRepository from "@/repositories/referral.repository";
import * as reviewRepository from "@/repositories/review.repository";
import * as rewardsRepository from "@/repositories/rewards.repository";
import * as supportTicketRepository from "@/repositories/support-ticket.repository";
import * as syncJobRepository from "@/repositories/sync-job.repository";
import { getPermissionsForAdminUser } from "@/services/permission.service";
import { getLowStockThreshold } from "@/services/system-settings.service";
import type { AdminModule } from "@/generated/prisma/client";

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function permissionKey(module: AdminModule): string {
  return `${module}:View`;
}

/**
 * Every widget's data fetch is independently wrapped so one failing data
 * source degrades that key to omitted rather than failing the whole
 * dashboard (AC #13's "coming soon" placeholder spirit, extended to real
 * data sources that error unexpectedly too).
 */
async function safe<T>(fn: () => Promise<T>, label: string): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[admin-dashboard] failed to load ${label}`, error);
    return undefined;
  }
}

export interface DashboardSummary {
  revenueToday?: { orderCount: number; grandTotal: string };
  pendingModeration?: { reviews: number; recipeReviews: number; blogComments: number };
  pendingProductQuestions?: { count: number };
  lowStock?: { count: number; threshold: number };
  rewardsReferrals?: { redemptions: number; referralSignups: number };
  supportTickets?: { open: number; inProgress: number; resolved: number; closed: number };
  failedPayments?: { count: number };
  erpSyncStatus?: {
    pending: number;
    failed: number;
    lastProcessedAt: string | null;
    /** STORY-056's generic SyncJob queue — a separate signal from the OrderIntegrationEvent fields above. */
    queueQueued?: number;
    queueFailed?: number;
    queueSucceededToday?: number;
  };
  /** STORY-058. Real, ExportPortal-gated counts — no longer a placeholder (see `placeholders` below). */
  exportEnquiryStatus?: { newCount: number; inDiscussionCount: number; quotedCount: number; wonThisMonth: number; lostThisMonth: number };
  /**
   * Live Visitors/System Health have no backing data source at all (see
   * the module doc comment) — these flags are still gated on the
   * module's View permission, same as every real widget, so an admin
   * without that module never sees even a "coming soon" placeholder
   * for it.
   */
  placeholders: { liveVisitors: boolean; systemHealth: boolean };
}

/**
 * Fetches the admin's full permission set once (getPermissionsForAdminUser
 * already does a single DB read), then includes each widget's key only when
 * its module is granted View — an ungranted or placeholder-only widget is
 * simply absent from the result, true server-side omission rather than a
 * client-side hide. Live Visitors/System Health have no backing data
 * source at all and are never included here — those two render as
 * static "coming soon" cards on the frontend, see
 * docs/architecture-decisions.md.
 */
export async function getDashboardSummary(adminUserId: string): Promise<DashboardSummary> {
  const permissions = await getPermissionsForAdminUser(adminUserId);
  const summary: DashboardSummary = {
    placeholders: {
      liveVisitors: permissions.has(permissionKey("CRMAnalytics")),
      systemHealth: permissions.has(permissionKey("UsersRolesAudit")),
    },
  };
  const today = startOfToday();

  if (permissions.has(permissionKey("Orders"))) {
    const revenue = await safe(() => orderRepository.getOrderSummaryForRange(today, new Date()), "revenueToday");
    if (revenue) summary.revenueToday = revenue;

    const failedPayments = await safe(() => paymentRepository.countFailedPaymentsSince(today), "failedPayments");
    if (failedPayments !== undefined) summary.failedPayments = { count: failedPayments };
  }

  if (permissions.has(permissionKey("Reviews"))) {
    const reviews = await safe(() => reviewRepository.countPendingReviews(), "pendingModeration.reviews");
    const recipeReviews = await safe(() => recipeReviewRepository.countPendingRecipeReviews(), "pendingModeration.recipeReviews");
    const blogComments = await safe(() => blogRepository.countPendingComments(), "pendingModeration.blogComments");
    summary.pendingModeration = { reviews: reviews ?? 0, recipeReviews: recipeReviews ?? 0, blogComments: blogComments ?? 0 };
  }

  if (permissions.has(permissionKey("QA"))) {
    const count = await safe(() => qaRepository.countPendingQuestions(), "pendingProductQuestions");
    if (count !== undefined) summary.pendingProductQuestions = { count };
  }

  if (permissions.has(permissionKey("Products"))) {
    const threshold = await getLowStockThreshold();
    const count = await safe(() => productRepository.countLowStockProducts(threshold), "lowStock");
    if (count !== undefined) summary.lowStock = { count, threshold };
  }

  if (permissions.has(permissionKey("RewardsReferrals"))) {
    const redemptions = await safe(() => rewardsRepository.countRedemptionsSince(today), "rewardsReferrals.redemptions");
    const referralSignups = await safe(() => referralRepository.countAttributionsSince(today), "rewardsReferrals.referralSignups");
    summary.rewardsReferrals = { redemptions: redemptions ?? 0, referralSignups: referralSignups ?? 0 };
  }

  if (permissions.has(permissionKey("Customers"))) {
    const byStatus = await safe(() => supportTicketRepository.countTicketsByStatus(), "supportTickets");
    if (byStatus) summary.supportTickets = byStatus;
  }

  if (permissions.has(permissionKey("ExportPortal"))) {
    const counts = await safe(() => exportEnquiryRepository.countsByStatus(), "exportEnquiryStatus.counts");
    const wonThisMonth = await safe(() => exportEnquiryRepository.countWonSince(startOfMonth()), "exportEnquiryStatus.wonThisMonth");
    const lostThisMonth = await safe(() => exportEnquiryRepository.countLostSince(startOfMonth()), "exportEnquiryStatus.lostThisMonth");
    if (counts) {
      const byStatus = new Map(counts.map((row) => [row.status, row.count]));
      summary.exportEnquiryStatus = {
        newCount: byStatus.get("New") ?? 0,
        inDiscussionCount: byStatus.get("InDiscussion") ?? 0,
        quotedCount: byStatus.get("Quoted") ?? 0,
        wonThisMonth: wonThisMonth ?? 0,
        lostThisMonth: lostThisMonth ?? 0,
      };
    }
  }

  if (permissions.has(permissionKey("ERPIntegration"))) {
    const erp = await safe(() => orderRepository.getErpSyncStatus(), "erpSyncStatus");
    const queue = await safe(() => syncJobRepository.getTodaySummary(), "erpSyncQueue");
    if (erp) {
      summary.erpSyncStatus = {
        ...erp,
        ...(queue ? { queueQueued: queue.queued, queueFailed: queue.failed, queueSucceededToday: queue.succeededToday } : {}),
      };
    }
  }

  return summary;
}
