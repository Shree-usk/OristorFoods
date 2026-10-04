import * as scheduledReportRepository from "@/repositories/scheduled-report.repository";
import type { ScheduledReportInput } from "@/repositories/scheduled-report.repository";
import * as analyticsService from "@/services/analytics.service";
import { writeAuditLog } from "@/services/audit-log.service";
import { getExecutiveSummary } from "@/services/executive-dashboard.service";
import { sendTransactionalEmail } from "@/services/notification.service";
import { requirePermission } from "@/services/permission.service";
import { ScheduledReportNotFoundError } from "@/services/scheduled-report.errors";

/**
 * STORY-059c. Scheduled report emails. No cron exists in this
 * codebase — the same constraint email-sms-campaign.service.ts's
 * processDueCampaigns already documents and resolves: a due row only
 * actually sends when an admin explicitly triggers "Send due reports
 * now". CRUD is View/Edit/Delete; processDueScheduledReports is gated
 * Approve, the same money/visibility-moving bar campaign-send and
 * refund processing already use, since it dispatches real emails to
 * real recipients.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

async function requireScheduledReportRow(id: string) {
  const report = await scheduledReportRepository.findScheduledReportById(id);
  if (!report) throw new ScheduledReportNotFoundError();
  return report;
}

export async function listScheduledReports(adminUserId: string) {
  await requirePermission(adminUserId, "CRMAnalytics", "View");
  return scheduledReportRepository.listScheduledReports();
}

export async function createScheduledReport(adminUserId: string, input: ScheduledReportInput) {
  await requirePermission(adminUserId, "CRMAnalytics", "Edit");
  const report = await scheduledReportRepository.createScheduledReport(input, adminUserId);
  await writeAuditLog({ actorId: adminUserId, action: "scheduled_report_created", module: "CRMAnalytics", targetType: "ScheduledReport", targetId: report.id, metadata: { reportType: report.reportType, frequency: report.frequency } });
  return report;
}

export async function updateScheduledReport(adminUserId: string, id: string, input: Partial<ScheduledReportInput>) {
  await requirePermission(adminUserId, "CRMAnalytics", "Edit");
  await requireScheduledReportRow(id);
  const report = await scheduledReportRepository.updateScheduledReport(id, input);
  await writeAuditLog({ actorId: adminUserId, action: "scheduled_report_updated", module: "CRMAnalytics", targetType: "ScheduledReport", targetId: id });
  return report;
}

export async function deleteScheduledReport(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "CRMAnalytics", "Delete");
  await requireScheduledReportRow(id);
  await scheduledReportRepository.deleteScheduledReport(id);
  await writeAuditLog({ actorId: adminUserId, action: "scheduled_report_deleted", module: "CRMAnalytics", targetType: "ScheduledReport", targetId: id });
}

/** The trailing window a report email summarizes — a week for Weekly, 30 days for Monthly, ending now. */
function reportRangeFor(frequency: "Weekly" | "Monthly", now: Date): { from: Date; to: Date } {
  const days = frequency === "Weekly" ? 7 : 30;
  return { from: new Date(now.getTime() - days * DAY_MS), to: now };
}

function formatExecutiveSummaryBody(summary: Awaited<ReturnType<typeof getExecutiveSummary>>, from: Date, to: Date): string {
  const fmtPercent = (value: number | null) => (value === null ? "n/a" : `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`);
  const line = (label: string, kpi: { current: number; changePercent: number | null }) => `${label}: ${kpi.current.toFixed(2)} (${fmtPercent(kpi.changePercent)} vs. prior period)`;
  return [
    `Executive Summary: ${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}`,
    "",
    line("Revenue", summary.revenue),
    line("Returning-customer rate", summary.returningCustomerRate),
    line("Average order value", summary.averageOrderValue),
    line("Loyalty engagement", summary.loyaltyEngagement),
    line("Export enquiry volume", summary.exportEnquiryVolume),
    "Core Web Vitals: Not available — no performance tracking exists yet.",
  ].join("\n");
}

async function buildReportBody(adminUserId: string, reportType: string, from: Date, to: Date): Promise<string> {
  const query = { from, to, bucket: "day" as const, limit: 10, metric: "products" as const };
  switch (reportType) {
    case "sales":
      return analyticsService.exportSalesReportCsv(adminUserId, query);
    case "customers":
      return analyticsService.exportCustomerReportCsv(adminUserId, query);
    case "products-recipes":
      return analyticsService.exportProductsRecipesReportCsv(adminUserId, query);
    case "funnel":
      return analyticsService.exportFunnelReportCsv(adminUserId, query);
    case "executive-summary": {
      const summary = await getExecutiveSummary(adminUserId, from, to);
      return formatExecutiveSummaryBody(summary, from, to);
    }
    default:
      throw new Error(`Unknown scheduled report type: ${reportType}`);
  }
}

function subjectFor(reportType: string, frequency: string): string {
  const label = reportType === "executive-summary" ? "Executive Summary" : reportType.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return `Oristor ${frequency} Report: ${label}`;
}

export async function processDueScheduledReports(adminUserId: string) {
  await requirePermission(adminUserId, "CRMAnalytics", "Approve");
  const now = new Date();
  const due = await scheduledReportRepository.listDueScheduledReports(now);

  const results: { reportId: string; reportType: string; recipientCount: number }[] = [];
  for (const report of due) {
    try {
      const { from, to } = reportRangeFor(report.frequency, now);
      const body = await buildReportBody(adminUserId, report.reportType, from, to);
      const subject = subjectFor(report.reportType, report.frequency);
      await sendTransactionalEmail(report.recipients.join(","), subject, body);
      await scheduledReportRepository.markScheduledReportSent(report.id, now);
      results.push({ reportId: report.id, reportType: report.reportType, recipientCount: report.recipients.length });
    } catch (error) {
      // One report's failure never aborts the rest of the batch — mirrors email-sms-campaign.service.ts::dispatchCampaign's per-recipient isolation.
      console.error(`[scheduled-report] failed to send report ${report.id}`, error);
    }
  }

  if (results.length > 0) {
    await writeAuditLog({ actorId: adminUserId, action: "scheduled_reports_processed_due", module: "CRMAnalytics", metadata: { results } });
  }
  return { processed: results.length, results };
}
