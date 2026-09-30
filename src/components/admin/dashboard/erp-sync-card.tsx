import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ErpSyncCard({ data }: { data: { pending: number; failed: number; lastProcessedAt: string | null } }) {
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
      </CardContent>
    </Card>
  );
}
