import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function FailedPaymentsCard({ data }: { data: { count: number } }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Failed Payments</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-h3 font-heading text-charcoal">{data.count}</p>
        <p className="mt-1 text-small text-charcoal/70">failed payment{data.count === 1 ? "" : "s"} today</p>
      </CardContent>
    </Card>
  );
}
