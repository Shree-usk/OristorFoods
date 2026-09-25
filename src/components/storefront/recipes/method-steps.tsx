import Image from "next/image";
import type { RecipeStepItem } from "@/types/recipe";

export function MethodSteps({ steps }: { steps: RecipeStepItem[] }) {
  return (
    <ol className="space-y-6">
      {steps.map((step) => (
        <li key={step.stepNumber} className="flex gap-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-chilli font-number text-small text-white">
            {step.stepNumber}
          </span>
          <div className="flex-1">
            <p className="text-body text-charcoal">{step.instruction}</p>
            {step.imageUrl && (
              <div className="relative mt-3 aspect-video overflow-hidden rounded-lg">
                <Image src={step.imageUrl} alt={`Step ${step.stepNumber}`} fill className="object-cover" />
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
