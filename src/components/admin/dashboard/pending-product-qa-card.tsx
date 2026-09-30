import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** STORY-039. Product Q&A only — recipe Q&A was never built as a distinct feature; see docs/architecture-decisions.md. */
export function PendingProductQaCard({ data }: { data: { count: number } }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Product Q&amp;A</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-h3 font-heading text-charcoal">{data.count}</p>
        <p className="mt-1 text-small text-charcoal/70">question{data.count === 1 ? "" : "s"} awaiting an answer</p>
      </CardContent>
    </Card>
  );
}
