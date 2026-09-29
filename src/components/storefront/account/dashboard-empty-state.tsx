import Link from "next/link";

import { Button } from "@/components/ui/button";

interface DashboardEmptyStateProps {
  message: string;
  ctaLabel: string;
  ctaHref: string;
}

/** STORY-033. Shared empty state for the dashboard's summary widgets — each defines its own message/CTA per the story's AC. */
export function DashboardEmptyState({ message, ctaLabel, ctaHref }: DashboardEmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-3 py-2">
      <p className="text-body text-charcoal/70">{message}</p>
      <Button size="sm" nativeButton={false} render={<Link href={ctaHref} />}>
        {ctaLabel}
      </Button>
    </div>
  );
}
