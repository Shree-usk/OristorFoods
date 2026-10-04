"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toCsv } from "@/lib/csv";
import {
  exportChurnTierToSegmentAdmin,
  fetchChurnScores,
  recomputeChurnScoresAdmin,
  type ChurnRiskTierValue,
} from "@/lib/api/admin-ai-insights-client";

const TIER_OPTIONS: { value: ChurnRiskTierValue | "All"; label: string }[] = [
  { value: "All", label: "All tiers" },
  { value: "High", label: "High" },
  { value: "Medium", label: "Medium" },
  { value: "Low", label: "Low" },
];

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * STORY-064. RFM-based churn risk (customer-segment.repository.ts's
 * real order data) — no engagement-signal data (site visits, email
 * opens) exists anywhere in this codebase, honestly omitted rather
 * than fabricated (see signalBreakdown.engagementSignalsAvailable).
 */
export function AdminChurnRiskTable() {
  const [tierFilter, setTierFilter] = useState<ChurnRiskTierValue | "All">("All");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [exportingTier, setExportingTier] = useState<ChurnRiskTierValue | null>(null);

  const { data, refetch } = useQuery({
    queryKey: ["admin-churn-scores", tierFilter],
    queryFn: () => fetchChurnScores(tierFilter === "All" ? {} : { riskTier: tierFilter }),
  });

  async function handleRecompute() {
    setActionError(null);
    setActionMessage(null);
    setIsRecomputing(true);
    try {
      const result = await recomputeChurnScoresAdmin();
      setActionMessage(`Scored ${result.customersScored} customers — ${result.tierCounts.High} High, ${result.tierCounts.Medium} Medium, ${result.tierCounts.Low} Low.`);
      await refetch();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to recompute churn scores.");
    } finally {
      setIsRecomputing(false);
    }
  }

  async function handleExport(tier: ChurnRiskTierValue) {
    setActionError(null);
    setActionMessage(null);
    setExportingTier(tier);
    try {
      const segment = await exportChurnTierToSegmentAdmin(tier);
      setActionMessage(`Created segment "${segment.name}" — available now in CRM Segmentation and as a campaign audience in the Marketing Console.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to export the segment.");
    } finally {
      setExportingTier(null);
    }
  }

  function handleCsvExport() {
    const rows = (data?.rows ?? []).map((row) => [row.customer.name ?? "", row.customer.email ?? "", row.riskTier, row.score.toFixed(1), String(row.signalBreakdown.daysSinceLastOrder), String(row.signalBreakdown.orderCount), row.signalBreakdown.totalSpent.toFixed(2)]);
    downloadCsv("churn-risk.csv", toCsv(["Name", "Email", "Risk Tier", "Score", "Days Since Last Order", "Order Count", "Total Spent"], rows));
  }

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-h5 font-heading text-charcoal">Churn Risk</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="churn-tier-filter" className="sr-only">
            Filter by risk tier
          </Label>
          <Select value={tierFilter} onValueChange={(value) => setTierFilter((value as ChurnRiskTierValue | "All") ?? "All")}>
            <SelectTrigger id="churn-tier-filter" className="w-36">
              <SelectValue>{(selected: string | null) => TIER_OPTIONS.find((option) => option.value === selected)?.label ?? "All tiers"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TIER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" size="sm" variant="outline" onClick={handleCsvExport} disabled={(data?.rows.length ?? 0) === 0}>
            Export CSV
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={handleRecompute} disabled={isRecomputing}>
            {isRecomputing ? "Recomputing…" : "Recompute Now"}
          </Button>
        </div>
      </div>

      {actionError && <p className="mt-2 text-small text-destructive">{actionError}</p>}
      {actionMessage && <p className="mt-2 text-small text-emerald-700">{actionMessage}</p>}

      <div className="mt-2 flex gap-2">
        {(["High", "Medium", "Low"] as const).map((tier) => (
          <Button key={tier} type="button" size="sm" variant="ghost" onClick={() => handleExport(tier)} disabled={exportingTier === tier}>
            {exportingTier === tier ? "Exporting…" : `Export ${tier} to Marketing`}
          </Button>
        ))}
      </div>

      {data && data.total > 0 && (
        <ResponsiveContainer width="100%" height={160} className="mt-4">
          <BarChart data={(["Low", "Medium", "High"] as const).map((tier) => ({ tier, customers: data.tierCounts[tier] }))}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="tier" />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="customers" fill="#B22222" name="Customers" />
          </BarChart>
        </ResponsiveContainer>
      )}

      <Table className="mt-2">
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Risk Tier</TableHead>
            <TableHead>Score</TableHead>
            <TableHead>Days Since Last Order</TableHead>
            <TableHead>Order Count</TableHead>
            <TableHead>Total Spent</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data?.rows ?? []).map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <Link href={`/admin/customers/${row.customer.id}`} className="font-medium text-primary hover:underline">
                  {row.customer.name ?? row.customer.email ?? row.customer.id}
                </Link>
              </TableCell>
              <TableCell>{row.riskTier}</TableCell>
              <TableCell>{row.score.toFixed(1)}</TableCell>
              <TableCell>{row.signalBreakdown.daysSinceLastOrder}</TableCell>
              <TableCell>{row.signalBreakdown.orderCount}</TableCell>
              <TableCell>{row.signalBreakdown.totalSpent.toFixed(2)}</TableCell>
            </TableRow>
          ))}
          {(data?.rows ?? []).length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-small text-charcoal/70">
                No churn scores yet — use Recompute Now.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
