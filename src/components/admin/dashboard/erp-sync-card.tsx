import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ErpSyncCardData {
  pending: number;
  failed: number;
  lastProcessedAt: string | null;
  /** STORY-056's generic SyncJob queue — a separate signal from the order-outbox fields above. */
  queueQueued?: number;
  queueFailed?: number;
  queueSucceededToday?: number;
}

export function ErpSyncCard({ data }: { data: ErpSyncCardData }) {
  const hasQueueData = data.queueQueued !== undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>ERP Sync Status</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="text-small text-charcoal/70">
          <li>{data.pending} pending</li>
          <li>{data.failed} failed</li>
          <li>Last synced: {data.lastProcessedAt ? new Date(data.lastProcessedAt).toLocaleString() : "never"}</li>
        </ul>
        {hasQueueData && (
          <ul className="mt-3 border-t border-border pt-3 text-small text-charcoal/70">
            <li className="font-medium text-charcoal">Sync queue</li>
            <li>{data.queueQueued} queued</li>
            <li>{data.queueFailed} failed</li>
            <li>{data.queueSucceededToday} succeeded today</li>
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
