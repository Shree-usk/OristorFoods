"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchJob, retryJob, type SyncJobDetail } from "@/lib/api/admin-erp-integration-client";

/** Mirrors sync-job.service.ts's MAX_ATTEMPTS — kept as a local constant since that service module pulls in server-only repositories/audit-log code that must never reach the client bundle. */
const MAX_ATTEMPTS = 5;

function retryEligibility(job: SyncJobDetail): { canRetry: boolean; blockedReason: string | null } {
  if (job.status !== "Failed") return { canRetry: false, blockedReason: null };
  if (job.attemptCount >= MAX_ATTEMPTS) return { canRetry: false, blockedReason: "Maximum retry attempts reached." };
  if (job.nextRetryAt && new Date(job.nextRetryAt).getTime() > Date.now()) {
    return { canRetry: false, blockedReason: `Retry available after ${new Date(job.nextRetryAt).toLocaleString()}.` };
  }
  return { canRetry: true, blockedReason: null };
}

/** STORY-056. Mirrors notification-templates-panel.tsx's Sheet-based detail-drawer pattern (STORY-054). */
export function SyncJobDetailDrawer({
  jobId,
  open,
  onOpenChange,
  onChanged,
}: {
  jobId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: job } = useQuery({ queryKey: ["admin-erp-job", jobId], queryFn: () => fetchJob(jobId), enabled: open });

  async function handleRetry() {
    setError(null);
    try {
      await retryJob(jobId);
      queryClient.invalidateQueries({ queryKey: ["admin-erp-job", jobId] });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to retry the sync job.");
    }
  }

  const { canRetry, blockedReason: retryBlockedReason } = job ? retryEligibility(job) : { canRetry: false, blockedReason: null };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{job ? `${job.jobType} — ${job.id}` : "Sync job"}</SheetTitle>
        </SheetHeader>

        {job && (
          <div className="grid gap-4 px-4">
            {error && <p className="text-small text-destructive">{error}</p>}

            <div className="flex items-center gap-2">
              <Badge variant={job.status === "Success" ? "default" : job.status === "Failed" ? "destructive" : "outline"}>{job.status}</Badge>
              <span className="text-small text-charcoal/70">{job.attemptCount} attempt(s)</span>
            </div>

            {job.targetEntityType && (
              <p className="text-small text-charcoal/70">
                Target: {job.targetEntityType} {job.targetEntityId}
              </p>
            )}

            {job.errorMessage && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-small font-medium text-destructive">Error</p>
                <p className="mt-1 text-small text-charcoal/80">{job.errorMessage}</p>
              </div>
            )}

            {job.payload && (
              <div>
                <p className="text-small font-medium text-charcoal">Payload</p>
                <pre className="mt-1 overflow-x-auto rounded-md border border-border bg-muted p-3 text-caption">{JSON.stringify(job.payload, null, 2)}</pre>
              </div>
            )}

            <div>
              <p className="text-small font-medium text-charcoal">Attempt history</p>
              <Table className="mt-2">
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {job.attempts.map((attempt) => (
                    <TableRow key={attempt.id}>
                      <TableCell>{attempt.attemptNumber}</TableCell>
                      <TableCell>{attempt.result}</TableCell>
                      <TableCell>{new Date(attempt.startedAt).toLocaleString()}</TableCell>
                      <TableCell>{attempt.errorDetail ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {retryBlockedReason && <p className="text-caption text-muted-foreground">{retryBlockedReason}</p>}
          </div>
        )}

        <SheetFooter>
          <Button onClick={handleRetry} disabled={!canRetry}>
            Retry
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
