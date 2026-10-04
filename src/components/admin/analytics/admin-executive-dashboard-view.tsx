"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminAiInsightsPanel } from "@/components/admin/analytics/admin-ai-insights-panel";
import { AdminChurnRiskTable } from "@/components/admin/analytics/admin-churn-risk-table";
import { AdminCampaignSuggestionCards } from "@/components/admin/analytics/admin-campaign-suggestion-cards";
import { fetchSalesReport } from "@/lib/api/admin-analytics-client";
import {
  createScheduledReportAdmin,
  deleteScheduledReportAdmin,
  fetchExecutiveSummary,
  fetchScheduledReports,
  processDueScheduledReportsAdmin,
  updateScheduledReportAdmin,
  type KpiComparison,
  type ScheduledReport,
  type ScheduledReportFormInput,
  type ScheduledReportFrequencyValue,
  type ScheduledReportTypeValue,
} from "@/lib/api/admin-executive-dashboard-client";

function defaultFrom(): string {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().slice(0, 10);
}

function defaultTo(): string {
  return new Date().toISOString().slice(0, 10);
}

const REPORT_TYPES: { value: ScheduledReportTypeValue; label: string }[] = [
  { value: "sales", label: "Sales" },
  { value: "customers", label: "Customers" },
  { value: "products-recipes", label: "Products & Recipes" },
  { value: "funnel", label: "Funnel" },
  { value: "executive-summary", label: "Executive Summary" },
];

const FREQUENCIES: { value: ScheduledReportFrequencyValue; label: string }[] = [
  { value: "Weekly", label: "Weekly" },
  { value: "Monthly", label: "Monthly" },
];

function KpiCard({ label, kpi, format }: { label: string; kpi: KpiComparison; format: (value: number) => string }) {
  const changeLabel = kpi.changePercent === null ? "n/a" : `${kpi.changePercent >= 0 ? "+" : ""}${kpi.changePercent.toFixed(1)}%`;
  const changeColor = kpi.changePercent === null ? "text-charcoal/50" : kpi.changePercent >= 0 ? "text-emerald-600" : "text-destructive";
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-small text-charcoal/60">{label}</p>
      <p className="mt-1 text-h4 font-heading text-charcoal">{format(kpi.current)}</p>
      <p className={`mt-1 text-small ${changeColor}`}>{changeLabel} vs. prior period</p>
    </div>
  );
}

interface ScheduledReportFormState {
  reportType: ScheduledReportTypeValue;
  recipientsText: string;
  frequency: ScheduledReportFrequencyValue;
}

function emptyForm(): ScheduledReportFormState {
  return { reportType: "executive-summary", recipientsText: "", frequency: "Weekly" };
}

function toFormState(report: ScheduledReport): ScheduledReportFormState {
  return { reportType: report.reportType, recipientsText: report.recipients.join(", "), frequency: report.frequency };
}

/** STORY-059c. A distinct, strategic/trend-level view from STORY-039's operational admin-dashboard.service.ts — see docs/architecture-decisions.md. */
export function AdminExecutiveDashboardView() {
  const queryClient = useQueryClient();
  const [from, setFrom] = useState(defaultFrom());
  const [to, setTo] = useState(defaultTo());
  const [actionError, setActionError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ScheduledReportFormState>(emptyForm());

  const { data: summary } = useQuery({ queryKey: ["admin-executive-summary", from, to], queryFn: () => fetchExecutiveSummary(from, to) });
  const { data: sales } = useQuery({ queryKey: ["admin-executive-sales-trend", from, to], queryFn: () => fetchSalesReport({ from, to, bucket: "day" }) });
  const { data: reports } = useQuery({ queryKey: ["admin-scheduled-reports"], queryFn: fetchScheduledReports });

  function refreshReports() {
    queryClient.invalidateQueries({ queryKey: ["admin-scheduled-reports"] });
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(report: ScheduledReport) {
    setEditingId(report.id);
    setForm(toFormState(report));
    setDialogOpen(true);
  }

  async function handleSubmit() {
    setActionError(null);
    const recipients = form.recipientsText.split(",").map((email) => email.trim()).filter(Boolean);
    const payload: ScheduledReportFormInput = { reportType: form.reportType, recipients, frequency: form.frequency };
    try {
      if (editingId) {
        await updateScheduledReportAdmin(editingId, payload);
      } else {
        await createScheduledReportAdmin(payload);
      }
      setDialogOpen(false);
      refreshReports();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to save the scheduled report.");
    }
  }

  async function handleDelete(id: string) {
    setActionError(null);
    try {
      await deleteScheduledReportAdmin(id);
      refreshReports();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to delete the scheduled report.");
    }
  }

  async function handleProcessDue() {
    setActionError(null);
    try {
      const result = await processDueScheduledReportsAdmin();
      refreshReports();
      setActionError(result.processed === 0 ? "No due reports to send." : null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to process due reports.");
    }
  }

  return (
    <div>
      <h1 className="text-h2 font-heading text-charcoal">Executive Dashboard</h1>
      <p className="mt-1 text-small text-charcoal/70">
        Strategic, trend-level KPIs for the business — distinct from the operational Admin Dashboard. Each figure compares the selected period against the immediately preceding period of equal length.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="exec-from">From</Label>
          <Input id="exec-from" type="date" className="w-40" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="exec-to">To</Label>
          <Input id="exec-to" type="date" className="w-40" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
      </div>

      {summary && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard label="Revenue" kpi={summary.revenue} format={(v) => v.toFixed(2)} />
          <KpiCard label="Returning-customer rate" kpi={summary.returningCustomerRate} format={(v) => `${(v * 100).toFixed(1)}%`} />
          <KpiCard label="Average order value" kpi={summary.averageOrderValue} format={(v) => v.toFixed(2)} />
          <KpiCard label="Loyalty engagement" kpi={summary.loyaltyEngagement} format={(v) => v.toFixed(0)} />
          <KpiCard label="Export enquiry volume" kpi={summary.exportEnquiryVolume} format={(v) => v.toFixed(0)} />
          <div className="rounded-lg border border-border p-4">
            <p className="text-small text-charcoal/60">Core Web Vitals</p>
            <p className="mt-1 text-small text-charcoal/50">Not available — no performance tracking exists yet.</p>
          </div>
        </div>
      )}

      {sales && (
        <>
          <h3 className="mt-8 text-h6 font-heading text-charcoal">Revenue Over Time</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={sales.trend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bucket" tickFormatter={(value: string) => value.slice(0, 10)} />
              <YAxis />
              <Tooltip labelFormatter={(label) => (typeof label === "string" ? label.slice(0, 10) : label)} />
              <Line type="monotone" dataKey="revenue" stroke="#B22222" name="Revenue" />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}

      <section aria-label="AI Insights">
        <AdminAiInsightsPanel />
        <AdminChurnRiskTable />
        <AdminCampaignSuggestionCards />
      </section>

      <div className="mt-8 flex items-center justify-between">
        <h3 className="text-h5 font-heading text-charcoal">Scheduled Reports</h3>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={handleProcessDue}>
            Send due reports now
          </Button>
          <Button type="button" size="sm" onClick={openCreate}>
            New scheduled report
          </Button>
        </div>
      </div>
      <p className="mt-1 text-small text-charcoal/70">No cron exists in this codebase — a due report only actually sends when an admin triggers &quot;Send due reports now&quot;.</p>

      {actionError && <p className="mt-2 text-small text-destructive">{actionError}</p>}

      <Table className="mt-2">
        <TableHeader>
          <TableRow>
            <TableHead>Report</TableHead>
            <TableHead>Recipients</TableHead>
            <TableHead>Frequency</TableHead>
            <TableHead>Last sent</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(reports ?? []).map((report) => (
            <TableRow key={report.id}>
              <TableCell className="font-medium">{REPORT_TYPES.find((t) => t.value === report.reportType)?.label ?? report.reportType}</TableCell>
              <TableCell>{report.recipients.join(", ")}</TableCell>
              <TableCell>{report.frequency}</TableCell>
              <TableCell>{report.lastSentAt ? new Date(report.lastSentAt).toLocaleString() : "Never"}</TableCell>
              <TableCell className="space-x-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => openEdit(report)}>
                  Edit
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => handleDelete(report.id)}>
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {(reports ?? []).length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-small text-charcoal/60">
                No scheduled reports yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <h2 className="text-h4 font-heading text-charcoal">{editingId ? "Edit scheduled report" : "New scheduled report"}</h2>

          <Label htmlFor="scheduled-report-type" className="mt-3 block">
            Report
          </Label>
          <Select value={form.reportType} onValueChange={(value) => setForm({ ...form, reportType: (value as ScheduledReportTypeValue) ?? "executive-summary" })}>
            <SelectTrigger id="scheduled-report-type">
              <SelectValue>{(selected: string | null) => REPORT_TYPES.find((option) => option.value === selected)?.label ?? "Executive Summary"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {REPORT_TYPES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Label htmlFor="scheduled-report-recipients" className="mt-3 block">
            Recipients (comma-separated emails)
          </Label>
          <Input
            id="scheduled-report-recipients"
            value={form.recipientsText}
            onChange={(event) => setForm({ ...form, recipientsText: event.target.value })}
            placeholder="finance@oristor.com, ceo@oristor.com"
          />

          <Label htmlFor="scheduled-report-frequency" className="mt-3 block">
            Frequency
          </Label>
          <Select value={form.frequency} onValueChange={(value) => setForm({ ...form, frequency: (value as ScheduledReportFrequencyValue) ?? "Weekly" })}>
            <SelectTrigger id="scheduled-report-frequency">
              <SelectValue>{(selected: string | null) => FREQUENCIES.find((option) => option.value === selected)?.label ?? "Weekly"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {FREQUENCIES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
