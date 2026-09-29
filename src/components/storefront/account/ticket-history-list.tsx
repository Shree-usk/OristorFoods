import { Badge } from "@/components/ui/badge";
import { DashboardEmptyState } from "@/components/storefront/account/dashboard-empty-state";
import type { TicketSummary } from "@/services/support-ticket.service";

const CATEGORY_LABELS: Record<TicketSummary["category"], string> = {
  OrderIssue: "Order issue",
  Product: "Product",
  Delivery: "Delivery",
  Billing: "Billing",
  Other: "Other",
};

const STATUS_VARIANT: Record<TicketSummary["status"], "secondary" | "outline"> = {
  Open: "outline",
  InProgress: "outline",
  Resolved: "secondary",
  Closed: "secondary",
};

const STATUS_LABELS: Record<TicketSummary["status"], string> = {
  Open: "Open",
  InProgress: "In progress",
  Resolved: "Resolved",
  Closed: "Closed",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-LK", { dateStyle: "medium" });
}

/** STORY-036. Plain presentational list — no reply thread (single message + status only, see docs/architecture-decisions.md). */
export function TicketHistoryList({ tickets }: { tickets: TicketSummary[] }) {
  if (tickets.length === 0) {
    return <DashboardEmptyState message="You haven't contacted support yet" ctaLabel="Send a message" ctaHref="#support-ticket-form" />;
  }

  return (
    <ul className="flex flex-col divide-y divide-input">
      {tickets.map((ticket) => (
        <li key={ticket.id} className="flex flex-col gap-1 py-3">
          <div className="flex items-center justify-between gap-4">
            <p className="font-medium text-charcoal">{ticket.subject}</p>
            <Badge variant={STATUS_VARIANT[ticket.status]}>{STATUS_LABELS[ticket.status]}</Badge>
          </div>
          <p className="text-caption text-charcoal/70">
            {CATEGORY_LABELS[ticket.category]} · {formatDate(ticket.createdAt)}
          </p>
          <p className="text-small text-charcoal/70">{ticket.message}</p>
        </li>
      ))}
    </ul>
  );
}
