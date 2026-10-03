import { toCsv } from "@/lib/csv";
import * as analyticsRepository from "@/repositories/analytics.repository";
import type { TrendBucket } from "@/repositories/analytics.repository";
import { renderAnalyticsReportPdf } from "@/services/analytics-pdf.service";
import { requirePermission } from "@/services/permission.service";

/**
 * STORY-059b. Analytics/BI reports hub — gated CRMAnalytics:View (its
 * second real consumer, after 059a's segment CRUD). Pure reads, no
 * audit logging (matches 059a's own previewSegment, which also
 * doesn't audit-log). Every report exposes a JSON getter (for the
 * chart/table UI) plus CSV/PDF export functions built on the one
 * shared toCsv/renderAnalyticsReportPdf utilities.
 */

export interface DateRangeQuery {
  from: Date;
  to: Date;
  bucket: TrendBucket;
  limit: number;
  /** Only read by the products-recipes export, to pick which of its two tables to produce. */
  metric: "products" | "recipes";
}

function formatMoney(value: number): string {
  return value.toFixed(2);
}

function formatDateRange(from: Date, to: Date): string {
  return `${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}`;
}

// --- Sales ---

export async function getSalesReport(adminUserId: string, query: DateRangeQuery) {
  await requirePermission(adminUserId, "CRMAnalytics", "View");
  const [trend, byCategory, byRegion] = await Promise.all([
    analyticsRepository.getSalesTrend(query.from, query.to, query.bucket),
    analyticsRepository.getSalesByCategory(query.from, query.to),
    analyticsRepository.getSalesByRegion(query.from, query.to),
  ]);
  return { trend, byCategory, byRegion };
}

function salesTrendTable(trend: Awaited<ReturnType<typeof analyticsRepository.getSalesTrend>>) {
  return { headers: ["Period", "Revenue", "Orders"], rows: trend.map((p) => [p.bucket.toISOString().slice(0, 10), formatMoney(p.revenue), String(p.orderCount)]) };
}

export async function exportSalesReportCsv(adminUserId: string, query: DateRangeQuery): Promise<string> {
  const { trend } = await getSalesReport(adminUserId, query);
  const { headers, rows } = salesTrendTable(trend);
  return toCsv(headers, rows);
}

export async function exportSalesReportPdf(adminUserId: string, query: DateRangeQuery): Promise<Buffer> {
  const { trend } = await getSalesReport(adminUserId, query);
  const { headers, rows } = salesTrendTable(trend);
  return renderAnalyticsReportPdf({ title: "Sales Trend", dateRange: formatDateRange(query.from, query.to), headers, rows });
}

// --- Customers ---

export async function getCustomerReport(adminUserId: string, query: DateRangeQuery) {
  await requirePermission(adminUserId, "CRMAnalytics", "View");
  const [acquisition, retention] = await Promise.all([
    analyticsRepository.getCustomerAcquisition(query.from, query.to, query.bucket),
    analyticsRepository.getCustomerRetention(query.from, query.to),
  ]);
  return { acquisition, retention };
}

function acquisitionTable(acquisition: Awaited<ReturnType<typeof analyticsRepository.getCustomerAcquisition>>) {
  return { headers: ["Period", "New Customers"], rows: acquisition.map((p) => [p.bucket.toISOString().slice(0, 10), String(p.newCustomers)]) };
}

export async function exportCustomerReportCsv(adminUserId: string, query: DateRangeQuery): Promise<string> {
  const { acquisition } = await getCustomerReport(adminUserId, query);
  const { headers, rows } = acquisitionTable(acquisition);
  return toCsv(headers, rows);
}

export async function exportCustomerReportPdf(adminUserId: string, query: DateRangeQuery): Promise<Buffer> {
  const { acquisition } = await getCustomerReport(adminUserId, query);
  const { headers, rows } = acquisitionTable(acquisition);
  return renderAnalyticsReportPdf({ title: "Customer Acquisition", dateRange: formatDateRange(query.from, query.to), headers, rows });
}

// --- Products & Recipes ---

export async function getProductsRecipesReport(adminUserId: string, query: DateRangeQuery) {
  await requirePermission(adminUserId, "CRMAnalytics", "View");
  const [topProducts, topRecipes] = await Promise.all([
    analyticsRepository.getTopProducts(query.from, query.to, query.limit),
    analyticsRepository.getTopRecipes(query.limit),
  ]);
  return { topProducts, topRecipes };
}

function topProductsTable(topProducts: Awaited<ReturnType<typeof analyticsRepository.getTopProducts>>) {
  return { headers: ["Product", "Quantity Sold", "Revenue"], rows: topProducts.map((p) => [p.productName, String(p.quantity), formatMoney(p.revenue)]) };
}

function topRecipesTable(topRecipes: Awaited<ReturnType<typeof analyticsRepository.getTopRecipes>>) {
  return { headers: ["Recipe", "Views", "Avg Rating", "Rating Count"], rows: topRecipes.map((r) => [r.title, String(r.viewCount), r.avgRating?.toFixed(1) ?? "—", String(r.ratingCount)]) };
}

export async function exportProductsRecipesReportCsv(adminUserId: string, query: DateRangeQuery): Promise<string> {
  const { topProducts, topRecipes } = await getProductsRecipesReport(adminUserId, query);
  const { headers, rows } = query.metric === "recipes" ? topRecipesTable(topRecipes) : topProductsTable(topProducts);
  return toCsv(headers, rows);
}

export async function exportProductsRecipesReportPdf(adminUserId: string, query: DateRangeQuery): Promise<Buffer> {
  const { topProducts, topRecipes } = await getProductsRecipesReport(adminUserId, query);
  const { headers, rows } = query.metric === "recipes" ? topRecipesTable(topRecipes) : topProductsTable(topProducts);
  return renderAnalyticsReportPdf({
    title: query.metric === "recipes" ? "Top Recipes" : "Top Products",
    dateRange: formatDateRange(query.from, query.to),
    headers,
    rows,
  });
}

// --- Funnel ---

export interface FunnelReport {
  cartsWithItems: number;
  confirmedOrders: number;
  visits: { available: false };
  checkout: { available: false };
}

export async function getFunnelReport(adminUserId: string, query: DateRangeQuery): Promise<FunnelReport> {
  await requirePermission(adminUserId, "CRMAnalytics", "View");
  const funnel = await analyticsRepository.getConversionFunnel(query.from, query.to);
  return { ...funnel, visits: { available: false }, checkout: { available: false } };
}

function funnelTable(funnel: FunnelReport) {
  return {
    headers: ["Stage", "Count"],
    rows: [
      ["Visits", "Not available"],
      ["Carts with items", String(funnel.cartsWithItems)],
      ["Checkout started", "Not available"],
      ["Confirmed orders", String(funnel.confirmedOrders)],
    ],
  };
}

export async function exportFunnelReportCsv(adminUserId: string, query: DateRangeQuery): Promise<string> {
  const funnel = await getFunnelReport(adminUserId, query);
  const { headers, rows } = funnelTable(funnel);
  return toCsv(headers, rows);
}

export async function exportFunnelReportPdf(adminUserId: string, query: DateRangeQuery): Promise<Buffer> {
  const funnel = await getFunnelReport(adminUserId, query);
  const { headers, rows } = funnelTable(funnel);
  return renderAnalyticsReportPdf({ title: "Conversion Funnel", dateRange: formatDateRange(query.from, query.to), headers, rows });
}
