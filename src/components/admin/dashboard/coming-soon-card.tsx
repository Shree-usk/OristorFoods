import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * STORY-039. Shared by Live Visitors, Export Enquiries, and System Health —
 * none has any backing data source yet (no session/pageview tracking, no B2B
 * enquiry model, no uptime/error-rate tracking). Per AC #13, a widget with no
 * implemented source renders this placeholder rather than erroring the whole
 * dashboard. See docs/architecture-decisions.md.
 */
export function ComingSoonCard({ title, note }: { title: string; note: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-small text-charcoal/70">Coming soon — {note}</p>
      </CardContent>
    </Card>
  );
}
