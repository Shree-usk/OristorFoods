"use client";

import { useEffect } from "react";

import { Section } from "@/components/storefront/layout/section";
import { Button } from "@/components/ui/button";

// Next.js 16 passes `unstable_retry` (not the older `reset`) to error boundaries.
export default function RecipesError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Section>
      <h1 className="text-h1 font-heading text-charcoal">Recipe Centre</h1>
      <div role="alert" className="mt-8 flex flex-col items-start gap-4">
        <p className="text-body text-charcoal">We couldn&apos;t load recipes right now.</p>
        <Button type="button" onClick={() => unstable_retry()}>
          Try again
        </Button>
      </div>
    </Section>
  );
}
