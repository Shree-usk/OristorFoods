import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** STORY-039. SupportTicket has no `priority` field — broken down by `status` instead; see docs/architecture-decisions.md. */
export function SupportTicketsCard({ data }: { data: { open: number; inProgress: number; resolved: number; closed: number } }) {
  const open = data.open + data.inProgress;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Support Tickets</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-h3 font-heading text-charcoal">{open}</p>
        <ul className="mt-1 text-small text-charcoal/70">
          <li>{data.open} open</li>
          <li>{data.inProgress} in progress</li>
          <li>{data.resolved} resolved</li>
          <li>{data.closed} closed</li>
        </ul>
      </CardContent>
    </Card>
  );
}
