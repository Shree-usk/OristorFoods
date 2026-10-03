"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  fetchJobs,
  triggerSync,
  type SyncJobFilters,
  type SyncJobStatusValue,
} from "@/lib/api/admin-erp-integration-client";
import { SyncJobDetailDrawer } from "./sync-job-detail-drawer";

const STATUS_LABELS: Record<SyncJobStatusValue | "all", string> = {
  all: "All statuses",
  Queued: "Queued",
  Processing: "Processing",
  Success: "Success",
  Failed: "Failed",
};

const EMPTY_TRIGGER_FORM = { jobType: "", targetEntityType: "", targetEntityId: "" };

/**
 * STORY-056. Mirrors admin-orders-list-view.tsx's filter-bar shape
 * (type/status/date-range + a search field) and admin-delivery-zones-
 * list-view.tsx's top-level module layout.
 */
export function AdminErpIntegrationView() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<SyncJobFilters>({});
  const [triggerForm, setTriggerForm] = useState(EMPTY_TRIGGER_FORM);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: jobs } = useQuery({ queryKey: ["admin-erp-jobs", filters], queryFn: () => fetchJobs(filters) });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-erp-jobs"] });
  }

  async function handleTrigger() {
    setTriggerError(null);
    try {
      await triggerSync({
        jobType: triggerForm.jobType,
        targetEntityType: triggerForm.targetEntityType || null,
        targetEntityId: triggerForm.targetEntityId || null,
      });
      setTriggerForm(EMPTY_TRIGGER_FORM);
      invalidate();
    } catch (err) {
      setTriggerError(err instanceof Error ? err.message : "Failed to trigger the sync.");
    }
  }

  function openJob(id: string) {
    setSelectedJobId(id);
    setDrawerOpen(true);
  }

  return (
    <div>
      <h1 className="text-h2 font-heading text-charcoal">ERP Integration</h1>
      <p className="mt-1 text-small text-muted-foreground">
        No real ERP system is connected yet (see `docs/blueprint.md` Section 10) — triggers and retries run against a stub connector.
      </p>

      <div className="mt-6 grid gap-3 rounded-md border border-dashed border-border p-4 sm:grid-cols-4">
        {triggerError && <p className="text-small text-destructive sm:col-span-4">{triggerError}</p>}
        <div>
          <Label htmlFor="trigger-job-type">Job type</Label>
          <Input id="trigger-job-type" placeholder="Order Export" value={triggerForm.jobType} onChange={(event) => setTriggerForm((prev) => ({ ...prev, jobType: event.target.value }))} />
        </div>
        <div>
          <Label htmlFor="trigger-target-type">Target entity type (optional)</Label>
          <Input id="trigger-target-type" placeholder="Order" value={triggerForm.targetEntityType} onChange={(event) => setTriggerForm((prev) => ({ ...prev, targetEntityType: event.target.value }))} />
        </div>
        <div>
          <Label htmlFor="trigger-target-id">Target entity ID (optional)</Label>
          <Input id="trigger-target-id" value={triggerForm.targetEntityId} onChange={(event) => setTriggerForm((prev) => ({ ...prev, targetEntityId: event.target.value }))} />
        </div>
        <div className="flex items-end">
          <Button type="button" onClick={handleTrigger} disabled={!triggerForm.jobType.trim()}>
            Trigger sync now
          </Button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="erp-filter-type">Filter by job type</Label>
          <Input id="erp-filter-type" className="w-48" value={filters.jobType ?? ""} onChange={(event) => setFilters((prev) => ({ ...prev, jobType: event.target.value || undefined }))} />
        </div>
        <div>
          <Label htmlFor="erp-filter-status">Status</Label>
          <Select
            value={filters.status ?? "all"}
            onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value === "all" ? undefined : (value as SyncJobStatusValue) }))}
          >
            <SelectTrigger id="erp-filter-status" className="w-44">
              <SelectValue>{(selected: SyncJobStatusValue | "all" | null) => STATUS_LABELS[selected ?? "all"]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_LABELS) as (SyncJobStatusValue | "all")[]).map((value) => (
                <SelectItem key={value} value={value}>
                  {STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="erp-filter-from">From</Label>
          <Input id="erp-filter-from" type="date" className="w-36" value={filters.dateFrom ?? ""} onChange={(event) => setFilters((prev) => ({ ...prev, dateFrom: event.target.value || undefined }))} />
        </div>
        <div>
          <Label htmlFor="erp-filter-to">To</Label>
          <Input id="erp-filter-to" type="date" className="w-36" value={filters.dateTo ?? ""} onChange={(event) => setFilters((prev) => ({ ...prev, dateTo: event.target.value || undefined }))} />
        </div>
        <div>
          <Label htmlFor="erp-filter-target">Target entity ID</Label>
          <Input id="erp-filter-target" className="w-48" value={filters.targetEntityId ?? ""} onChange={(event) => setFilters((prev) => ({ ...prev, targetEntityId: event.target.value || undefined }))} />
        </div>
      </div>

      <Table className="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Attempts</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(jobs ?? []).map((job) => (
            <TableRow key={job.id} className="cursor-pointer" onClick={() => openJob(job.id)}>
              <TableCell>{job.jobType}</TableCell>
              <TableCell>
                <Badge variant={job.status === "Success" ? "default" : job.status === "Failed" ? "destructive" : "outline"}>{job.status}</Badge>
              </TableCell>
              <TableCell>{job.targetEntityType ? `${job.targetEntityType} ${job.targetEntityId}` : "—"}</TableCell>
              <TableCell>{job.attemptCount}</TableCell>
              <TableCell>{new Date(job.createdAt).toLocaleString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selectedJobId && <SyncJobDetailDrawer jobId={selectedJobId} open={drawerOpen} onOpenChange={setDrawerOpen} onChanged={invalidate} />}
    </div>
  );
}
