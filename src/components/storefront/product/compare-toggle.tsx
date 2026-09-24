"use client";

import { useEffect, useState } from "react";
import { Scale } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCompareStore } from "@/lib/stores/compare-store";

export function CompareToggle({ productId, className }: { productId: string; className?: string }) {
  const isComparing = useCompareStore((state) => state.has(productId));
  const add = useCompareStore((state) => state.add);
  const remove = useCompareStore((state) => state.remove);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(timeout);
  }, [message]);

  function handleClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (isComparing) {
      remove(productId);
      return;
    }

    const result = add(productId);
    if (result === "full") {
      setMessage("Compare is full — remove one to add another.");
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={className}
        aria-pressed={isComparing}
        aria-label={isComparing ? "Remove from compare" : "Add to compare"}
        onClick={handleClick}
      >
        <Scale className={isComparing ? "fill-current" : undefined} />
      </Button>
      <div aria-live="polite" className="sr-only">
        {message}
      </div>
    </>
  );
}
