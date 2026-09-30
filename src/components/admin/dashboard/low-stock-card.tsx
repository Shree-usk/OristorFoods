import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LowStockCard({ data }: { data: { count: number; threshold: number } }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Low Stock Alerts</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-h3 font-heading text-charcoal">{data.count}</p>
        <p className="mt-1 text-small text-charcoal/70">product{data.count === 1 ? "" : "s"} at or below {data.threshold} units</p>
      </CardContent>
    </Card>
  );
}
