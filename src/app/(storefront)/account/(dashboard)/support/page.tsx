import type { Metadata } from "next";

import { auth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SupportTicketForm } from "@/components/storefront/account/support-ticket-form";
import { TicketHistoryList } from "@/components/storefront/account/ticket-history-list";
import { listTicketsForUser } from "@/services/support-ticket.service";

export const metadata: Metadata = {
  title: "Support",
  robots: { index: false, follow: false },
};

const HISTORY_PAGE_SIZE = 20;

/** STORY-036. Server Component — no reply thread this story (single message + status only, see docs/architecture-decisions.md). */
export default async function SupportPage() {
  const session = await auth();
  const userId = session!.user.id;

  const history = await listTicketsForUser(userId, 1, HISTORY_PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h2 font-heading text-charcoal">Support</h1>

      <Card>
        <CardHeader>
          <CardTitle>Contact us</CardTitle>
        </CardHeader>
        <CardContent>
          <SupportTicketForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your messages</CardTitle>
        </CardHeader>
        <CardContent>
          <TicketHistoryList tickets={history.tickets} />
        </CardContent>
      </Card>
    </div>
  );
}
