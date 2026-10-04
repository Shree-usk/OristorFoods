"use client";

import { useState } from "react";
import { MessageCircleQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SupportAssistantWidget } from "@/components/storefront/ai/support-assistant-widget";

/**
 * STORY-063. Mounted once in (storefront)/layout.tsx, same sitewide
 * pattern as PopupTriggerController — "a persistent chat widget/
 * launcher... available sitewide" (AC #1). Fixed bottom-left: 062's
 * Recipe Assistant already occupies bottom-right on pages where both
 * appear.
 */
export function SupportAssistantLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* bottom-20 clears MobileNav's h-16 fixed bar on small screens (lg:hidden); lg:bottom-4 once it's gone. */}
      <div className="fixed bottom-20 left-4 z-40 lg:bottom-4 print:hidden">
        <Button type="button" variant="outline" onClick={() => setOpen(true)} className="gap-2 shadow-md">
          <MessageCircleQuestion className="size-4" aria-hidden="true" />
          Support
        </Button>
      </div>
      <SupportAssistantWidget open={open} onOpenChange={setOpen} />
    </>
  );
}
