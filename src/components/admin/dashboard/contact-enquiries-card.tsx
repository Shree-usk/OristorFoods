import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface ContactEnquiriesCardData {
  newCount: number;
  inProgressCount: number;
  respondedCount: number;
}

export function ContactEnquiriesCard({ data }: { data: ContactEnquiriesCardData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact Enquiries</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="text-small text-charcoal/70">
          <li>{data.newCount} new</li>
          <li>{data.inProgressCount} in progress</li>
          <li>{data.respondedCount} responded</li>
        </ul>
        <Link href="/admin/contact-enquiries" className="mt-2 inline-block text-small font-medium text-chilli hover:underline">
          View all →
        </Link>
      </CardContent>
    </Card>
  );
}
