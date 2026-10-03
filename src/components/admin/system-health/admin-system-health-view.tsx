"use client";

import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchSystemHealth } from "@/lib/api/admin-system-health-client";

/** STORY-057. The full-detail counterpart to the Admin Dashboard's System Health summary widget — unavailable sections are shown as "Not available yet," never hidden, per system-health.service.ts's own honest-placeholder design. */
export function AdminSystemHealthView() {
  const { data } = useQuery({ queryKey: ["admin-system-health"], queryFn: fetchSystemHealth });

  return (
    <div>
      <h1 className="text-h2 font-heading text-charcoal">System Health</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>ERP Order Outbox</CardTitle>
          </CardHeader>
          <CardContent>
            {data ? (
              <ul className="text-small text-charcoal/70">
                <li>{data.erp.orderOutbox.pending} pending</li>
                <li>{data.erp.orderOutbox.failed} failed</li>
                <li>Last synced: {data.erp.orderOutbox.lastProcessedAt ? new Date(data.erp.orderOutbox.lastProcessedAt).toLocaleString() : "never"}</li>
              </ul>
            ) : (
              <p className="text-small text-charcoal/70">Loading…</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ERP Sync Queue</CardTitle>
          </CardHeader>
          <CardContent>
            {data ? (
              <ul className="text-small text-charcoal/70">
                <li>{data.erp.syncQueue.queued} queued</li>
                <li>{data.erp.syncQueue.failed} failed</li>
                <li>{data.erp.syncQueue.succeededToday} succeeded today</li>
              </ul>
            ) : (
              <p className="text-small text-charcoal/70">Loading…</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Uptime</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-small text-muted-foreground">Not available yet — no uptime monitoring is wired up in this environment.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>API Error Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-small text-muted-foreground">Not available yet — no error-rate tracking is wired up in this environment.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Last Backup</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-small text-muted-foreground">Not available yet — no backup system is wired up in this environment.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
