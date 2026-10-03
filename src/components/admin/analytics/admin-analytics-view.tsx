"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchCustomerReport,
  fetchFunnelReport,
  fetchProductsRecipesReport,
  fetchSalesReport,
  reportExportUrl,
  type AnalyticsQuery,
} from "@/lib/api/admin-analytics-client";

function defaultFrom(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().slice(0, 10);
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10);
}

const BUCKET_OPTIONS: { value: "day" | "week" | "month"; label: string }[] = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
];

function ExportButtons({ report, query, metric }: { report: "sales" | "customers" | "products-recipes" | "funnel"; query: AnalyticsQuery; metric?: "products" | "recipes" }) {
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" nativeButton={false} render={<a href={reportExportUrl(report, { ...query, format: "csv", metric })} />}>
        Export CSV
      </Button>
      <Button size="sm" variant="outline" nativeButton={false} render={<a href={reportExportUrl(report, { ...query, format: "pdf", metric })} />}>
        Export PDF
      </Button>
    </div>
  );
}

/** STORY-059b. First Recharts usage in this codebase — a tabbed reports hub (Sales/Customers/Products & Recipes/Funnel), each sharing the date-range + bucket filter above. */
export function AdminAnalyticsView() {
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(defaultTo());
  const [bucket, setBucket] = useState<"day" | "week" | "month">("day");
  const query: AnalyticsQuery = { from, to, bucket };

  const { data: sales } = useQuery({ queryKey: ["admin-analytics-sales", query], queryFn: () => fetchSalesReport(query) });
  const { data: customers } = useQuery({ queryKey: ["admin-analytics-customers", query], queryFn: () => fetchCustomerReport(query) });
  const { data: productsRecipes } = useQuery({ queryKey: ["admin-analytics-products-recipes", query], queryFn: () => fetchProductsRecipesReport(query) });
  const { data: funnel } = useQuery({ queryKey: ["admin-analytics-funnel", query], queryFn: () => fetchFunnelReport(query) });

  return (
    <div>
      <h1 className="text-h2 font-heading text-charcoal">Analytics</h1>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="analytics-from">From</Label>
          <Input id="analytics-from" type="date" className="w-40" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="analytics-to">To</Label>
          <Input id="analytics-to" type="date" className="w-40" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="analytics-bucket">Trend interval</Label>
          <Select value={bucket} onValueChange={(value) => setBucket((value as "day" | "week" | "month") ?? "day")}>
            <SelectTrigger id="analytics-bucket" className="w-36">
              <SelectValue>{(selected: string | null) => BUCKET_OPTIONS.find((option) => option.value === selected)?.label ?? "Daily"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {BUCKET_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="sales" className="mt-6">
        <TabsList>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="products-recipes">Products &amp; Recipes</TabsTrigger>
          <TabsTrigger value="funnel">Funnel</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <div className="mt-3 flex items-center justify-between">
            <h2 className="text-h5 font-heading text-charcoal">Revenue &amp; Orders Over Time</h2>
            <ExportButtons report="sales" query={query} />
          </div>
          {sales && (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={sales.trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" tickFormatter={(value: string) => value.slice(0, 10)} />
                  <YAxis />
                  <Tooltip labelFormatter={(label) => (typeof label === "string" ? label.slice(0, 10) : label)} />
                  <Line type="monotone" dataKey="revenue" stroke="#B22222" name="Revenue" />
                  <Line type="monotone" dataKey="orderCount" stroke="#CDAF52" name="Orders" />
                </LineChart>
              </ResponsiveContainer>

              <h3 className="mt-6 text-h6 font-heading text-charcoal">By Category</h3>
              <Table className="mt-2">
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.byCategory.map((row) => (
                    <TableRow key={row.categoryName}>
                      <TableCell>{row.categoryName}</TableCell>
                      <TableCell>{row.quantity}</TableCell>
                      <TableCell>{row.revenue.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <h3 className="mt-6 text-h6 font-heading text-charcoal">By Region</h3>
              <Table className="mt-2">
                <TableHeader>
                  <TableRow>
                    <TableHead>Region</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.byRegion.map((row) => (
                    <TableRow key={row.region}>
                      <TableCell>{row.region}</TableCell>
                      <TableCell>{row.orderCount}</TableCell>
                      <TableCell>{row.revenue.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </TabsContent>

        <TabsContent value="customers">
          <div className="mt-3 flex items-center justify-between">
            <h2 className="text-h5 font-heading text-charcoal">New Customers Over Time</h2>
            <ExportButtons report="customers" query={query} />
          </div>
          {customers && (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={customers.acquisition}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" tickFormatter={(value: string) => value.slice(0, 10)} />
                  <YAxis />
                  <Tooltip labelFormatter={(label) => (typeof label === "string" ? label.slice(0, 10) : label)} />
                  <Bar dataKey="newCustomers" fill="#B22222" name="New customers" />
                </BarChart>
              </ResponsiveContainer>

              <h3 className="mt-6 text-h6 font-heading text-charcoal">Retention</h3>
              <p className="mt-1 text-small text-charcoal/70">
                Of the {customers.retention.activeCustomers} customers who ordered in this period, {customers.retention.repeatCustomers} have placed 2+ orders all-time — a{" "}
                {(customers.retention.retentionRate * 100).toFixed(1)}% repeat-purchase rate.
              </p>
            </>
          )}
        </TabsContent>

        <TabsContent value="products-recipes">
          <div className="mt-3 flex items-center justify-between">
            <h2 className="text-h5 font-heading text-charcoal">Top Products</h2>
            <ExportButtons report="products-recipes" query={query} metric="products" />
          </div>
          {productsRecipes && (
            <>
              <Table className="mt-2">
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Quantity Sold</TableHead>
                    <TableHead>Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productsRecipes.topProducts.map((row) => (
                    <TableRow key={row.productId}>
                      <TableCell>{row.productName}</TableCell>
                      <TableCell>{row.quantity}</TableCell>
                      <TableCell>{row.revenue.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-6 flex items-center justify-between">
                <h2 className="text-h5 font-heading text-charcoal">Top Recipes</h2>
                <ExportButtons report="products-recipes" query={query} metric="recipes" />
              </div>
              <Table className="mt-2">
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipe</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Avg Rating</TableHead>
                    <TableHead>Rating Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productsRecipes.topRecipes.map((row) => (
                    <TableRow key={row.recipeId}>
                      <TableCell>{row.title}</TableCell>
                      <TableCell>{row.viewCount}</TableCell>
                      <TableCell>{row.avgRating?.toFixed(1) ?? "—"}</TableCell>
                      <TableCell>{row.ratingCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </TabsContent>

        <TabsContent value="funnel">
          <div className="mt-3 flex items-center justify-between">
            <h2 className="text-h5 font-heading text-charcoal">Conversion Funnel</h2>
            <ExportButtons report="funnel" query={query} />
          </div>
          {funnel && (
            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg border border-border p-4">
                <p className="text-small text-charcoal/60">Visits</p>
                <p className="mt-1 text-small text-charcoal/50">Not available — no visit tracking exists yet.</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-small text-charcoal/60">Carts with items</p>
                <p className="mt-1 text-h4 font-heading text-charcoal">{funnel.cartsWithItems}</p>
                <p className="mt-1 text-small text-charcoal/50">Best-effort: current carts touched in this period, not a full historical count.</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-small text-charcoal/60">Checkout started</p>
                <p className="mt-1 text-small text-charcoal/50">Not available — not tracked as a distinct step.</p>
              </div>
              <div className="rounded-lg border border-border p-4">
                <p className="text-small text-charcoal/60">Confirmed orders</p>
                <p className="mt-1 text-h4 font-heading text-charcoal">{funnel.confirmedOrders}</p>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
