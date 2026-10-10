import { Check } from "lucide-react";

const MAX_QUICK_FACTS = 4;

/**
 * Scannable chip strip near the top of the PDP, condensed from the same
 * `benefits` list the full "Benefits" section renders further down — no
 * new admin-managed field, just a second, shorter presentation of data
 * that's already there.
 */
export function QuickFacts({ benefits }: { benefits: string[] }) {
  if (benefits.length === 0) return null;

  return (
    <ul className="mt-4 flex flex-wrap gap-2" aria-label="Quick facts">
      {benefits.slice(0, MAX_QUICK_FACTS).map((benefit) => (
        <li
          key={benefit}
          className="inline-flex items-center gap-1.5 rounded-full border border-leaf/30 bg-leaf/10 px-3 py-1 text-caption text-leaf-dark"
        >
          <Check aria-hidden="true" className="size-3.5" />
          {benefit}
        </li>
      ))}
    </ul>
  );
}
