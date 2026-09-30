import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatCurrency(amount: string): string {
  return `LKR ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function RevenueOrdersCard({ data }: { data: { orderCount: number; grandTotal: string } }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&apos;s Revenue &amp; Orders</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-h3 font-heading text-charcoal">{formatCurrency(data.grandTotal)}</p>
        <p className="mt-1 text-small text-charcoal/70">
          {data.orderCount} order{data.orderCount === 1 ? "" : "s"} today
        </p>
      </CardContent>
    </Card>
  );
}
