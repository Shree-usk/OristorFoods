"use client";

import { cn } from "@/lib/utils";
import { CHECKOUT_STEPS, type CheckoutStep } from "@/lib/stores/checkout-store";

/**
 * `steps` is a list of { number, label } pairs rather than always
 * CHECKOUT_STEPS.map((label, i) => i + 1) — a non-export cart never shows
 * step 1 (Export Details) at all, so the caller (checkout-wizard.tsx)
 * passes the filtered, renumbered-for-display list that actually applies
 * to the current cart.
 */
export function CheckoutStepIndicator({
  currentStep,
  steps = CHECKOUT_STEPS.map((label, index) => ({ number: (index + 1) as CheckoutStep, label })),
}: {
  currentStep: CheckoutStep;
  steps?: { number: CheckoutStep; label: string }[];
}) {
  return (
    <nav aria-label="Checkout progress">
      <ol className="flex flex-wrap items-center gap-2 sm:gap-4">
        {steps.map(({ number: stepNumber, label }, index) => {
          const isCurrent = stepNumber === currentStep;
          const isComplete = stepNumber < currentStep;
          return (
            <li key={label} className="flex items-center gap-2" aria-current={isCurrent ? "step" : undefined}>
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border text-small font-number",
                  isCurrent && "border-chilli bg-chilli text-white",
                  isComplete && "border-chilli text-chilli",
                  !isCurrent && !isComplete && "border-input text-charcoal/70",
                )}
              >
                {isComplete ? "✓" : index + 1}
              </span>
              <span className={cn("text-small", isCurrent ? "font-semibold text-charcoal" : "text-charcoal/70")}>
                {label}
                {isComplete && <span className="sr-only"> (completed)</span>}
              </span>
              {index < steps.length - 1 && <span aria-hidden="true" className="hidden text-charcoal/30 sm:inline">—</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
