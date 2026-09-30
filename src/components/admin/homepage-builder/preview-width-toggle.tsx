"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

/** Core-scope "preview" per the user's scope decision: a width-constrained container, not a real device emulator or iframe — the actual storefront components render at whatever width the container allows. */
export function PreviewWidthToggle({ children }: { children: React.ReactNode }) {
  const [width, setWidth] = useState<"desktop" | "mobile">("desktop");

  return (
    <div>
      <div className="flex justify-center gap-2 border-b border-border bg-beige py-3">
        <Button variant={width === "desktop" ? "default" : "outline"} size="sm" onClick={() => setWidth("desktop")}>
          Desktop
        </Button>
        <Button variant={width === "mobile" ? "default" : "outline"} size="sm" onClick={() => setWidth("mobile")}>
          Mobile
        </Button>
      </div>
      <div className={width === "mobile" ? "mx-auto max-w-sm overflow-x-hidden border-x border-border" : ""}>{children}</div>
    </div>
  );
}
