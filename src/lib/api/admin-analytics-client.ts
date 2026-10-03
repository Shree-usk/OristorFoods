/** STORY-059b. Fetch wrappers for /api/admin/analytics/*. */

export interface AnalyticsQuery {
  from: string;
  to: string;
  bucket?: "day" | "week" | "month";
  limit?: number;
}

export interface SalesTrendPoint {
  bucket: string;
  revenue: number;
  orderCount: number;
}
export interface SalesByCategoryRow {
  categoryName: string;
  revenue: number;
  quantity: number;
}
export interface SalesByRegionRow {
  region: string;
  revenue: number;
  orderCount: number;
}
export interface SalesReport {
  trend: SalesTrendPoint[];
  byCategory: SalesByCategoryRow[];
  byRegion: SalesByRegionRow[];
}

export interface AcquisitionPoint {
  bucket: string;
  newCustomers: number;
}
export interface RetentionSummary {
  activeCustomers: number;
  repeatCustomers: number;
  retentionRate: number;
}
export interface CustomerReport {
  acquisition: AcquisitionPoint[];
  retention: RetentionSummary;
}

export interface TopProductRow {
  productId: string;
  productName: string;
  quantity: number;
  revenue: number;
}
export interface TopRecipeRow {
  recipeId: string;
  title: string;
  viewCount: number;
  avgRating: number | null;
  ratingCount: number;
}
export interface ProductsRecipesReport {
  topProducts: TopProductRow[];
  topRecipes: TopRecipeRow[];
}

export interface FunnelReport {
  cartsWithItems: number;
  confirmedOrders: number;
  visits: { available: false };
  checkout: { available: false };
}

function toSearchParams(query: AnalyticsQuery): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
  return params;
}

async function fetchJson<T>(path: string, query: AnalyticsQuery): Promise<T> {
  const response = await fetch(`${path}?${toSearchParams(query).toString()}`);
  if (!response.ok) throw new Error(`Failed to load the report (${response.status})`);
  return response.json();
}

export const fetchSalesReport = (query: AnalyticsQuery) => fetchJson<SalesReport>("/api/admin/analytics/sales", query);
export const fetchCustomerReport = (query: AnalyticsQuery) => fetchJson<CustomerReport>("/api/admin/analytics/customers", query);
export const fetchProductsRecipesReport = (query: AnalyticsQuery) => fetchJson<ProductsRecipesReport>("/api/admin/analytics/products-recipes", query);
export const fetchFunnelReport = (query: AnalyticsQuery) => fetchJson<FunnelReport>("/api/admin/analytics/funnel", query);

export function reportExportUrl(report: "sales" | "customers" | "products-recipes" | "funnel", query: AnalyticsQuery & { format: "csv" | "pdf"; metric?: "products" | "recipes" }): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== "") params.set(key, String(value));
  return `/api/admin/analytics/${report}?${params.toString()}`;
}
