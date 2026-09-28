"use client";

import { cn } from "@/lib/utils";
import { CHECKOUT_STEPS, type CheckoutStep } from "@/lib/stores/checkout-store";

export function CheckoutStepIndicator({ currentStep }: { currentStep: CheckoutStep }) {
  return (
    <nav aria-label="Checkout progress">
      <ol className="flex flex-wrap items-center gap-2 sm:gap-4">
        {CHECKOUT_STEPS.map((label, index) => {
          const stepNumber = index + 1;
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
                  !isCurrent && !isComplete && "border-input text-charcoal/50",
                )}
              >
                {isComplete ? "✓" : stepNumber}
              </span>
              <span className={cn("text-small", isCurrent ? "font-semibold text-charcoal" : "text-charcoal/60")}>
                {label}
                {isComplete && <span className="sr-only"> (completed)</span>}
              </span>
              {stepNumber < CHECKOUT_STEPS.length && <span aria-hidden="true" className="hidden text-charcoal/30 sm:inline">—</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
