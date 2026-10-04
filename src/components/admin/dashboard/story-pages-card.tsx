import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** STORY-074. No counts to show — a plain gated link, same shape as the other dashboard cards. */
export function StoryPagesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Page Content</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-small text-charcoal/70">Edit About Us & Contact Us page content</p>
        <Link href="/admin/story-pages" className="mt-2 inline-block text-small font-medium text-chilli hover:underline">
          Edit →
        </Link>
      </CardContent>
    </Card>
  );
}
