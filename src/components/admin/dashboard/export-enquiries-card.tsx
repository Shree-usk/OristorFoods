import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ExportEnquiriesCardData {
  newCount: number;
  inDiscussionCount: number;
  quotedCount: number;
  wonThisMonth: number;
  lostThisMonth: number;
}

export function ExportEnquiriesCard({ data }: { data: ExportEnquiriesCardData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Enquiries</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="text-small text-charcoal/70">
          <li>{data.newCount} new</li>
          <li>{data.inDiscussionCount} in discussion</li>
          <li>{data.quotedCount} quoted</li>
          <li>{data.wonThisMonth} won this month</li>
          <li>{data.lostThisMonth} lost this month</li>
        </ul>
      </CardContent>
    </Card>
  );
}
