import { Check } from "lucide-react";

import type { OrderStatusHistoryEntry } from "@/types/checkout";

/**
 * Reusable order status display (STORY-028): the pipeline position plus
 * the full timestamped history. Presentational only — no data fetching —
 * so STORY-036's future order-history dashboard can render it unmodified
 * from whatever it fetches.
 */

const PIPELINE_STEPS: Array<{ status: string; label: string }> = [
  { status: "PendingConfirmation", label: "Pending confirmation" },
  { status: "Confirmed", label: "Confirmed" },
  { status: "Processing", label: "Processing" },
  { status: "Dispatched", label: "Dispatched" },
  { status: "Delivered", label: "Delivered" },
];

const TERMINAL_LABELS: Record<string, string> = {
  Cancelled: "This order was cancelled.",
  Returned: "This item was returned.",
};

const STATUS_LABELS: Record<string, string> = {
  ...Object.fromEntries(PIPELINE_STEPS.map((step) => [step.status, step.label])),
  ...TERMINAL_LABELS,
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" });
}

interface OrderStatusTimelineProps {
  status: string;
  statusHistory: OrderStatusHistoryEntry[];
}

export function OrderStatusTimeline({ status, statusHistory }: OrderStatusTimelineProps) {
  const isTerminal = status in TERMINAL_LABELS;
  const currentStepIndex = PIPELINE_STEPS.findIndex((step) => step.status === status);

  return (
    <div>
      {isTerminal ? (
        <p role="status" className="rounded-lg border border-gold bg-cream p-4 text-body text-charcoal">
          {TERMINAL_LABELS[status]}
        </p>
      ) : (
        <ol className="flex flex-wrap gap-x-2 gap-y-3" aria-label="Order status">
          {PIPELINE_STEPS.map((step, index) => {
            const isDone = currentStepIndex >= 0 && index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            return (
              <li key={step.status} className="flex items-center gap-2">
                <span
                  aria-current={isCurrent ? "step" : undefined}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-small font-medium ${
                    isCurrent
                      ? "bg-chilli text-cream"
                      : isDone
                        ? "bg-leaf-dark/10 text-leaf-dark"
                        : "bg-muted text-charcoal/50"
                  }`}
                >
                  {isDone && <Check className="size-3.5" aria-hidden="true" />}
                  {step.label}
                </span>
                {index < PIPELINE_STEPS.length - 1 && <span aria-hidden="true" className="text-charcoal/30">→</span>}
              </li>
            );
          })}
        </ol>
      )}

      {statusHistory.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-small font-medium text-charcoal/70">Status history</summary>
          <ul className="mt-2 flex flex-col gap-1 border-l border-input pl-4 text-small text-charcoal/70">
            {statusHistory.map((entry, index) => (
              <li key={`${entry.status}-${entry.createdAt}-${index}`}>
                <span className="font-medium text-charcoal">{STATUS_LABELS[entry.status] ?? entry.status}</span>
                {" — "}
                {formatTimestamp(entry.createdAt)}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
