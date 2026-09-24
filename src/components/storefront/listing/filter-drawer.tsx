"use client";

import { useState, type ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface FilterDrawerProps {
  children: ReactNode;
  title?: string;
}

/** Mobile (below lg) filter sheet. Pairs with FilterSidebar, which shows the same controls on desktop. */
export function FilterDrawer({ children, title = "Filters" }: FilterDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        Filters
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">{children}</div>
          <Button type="button" className="mx-4 mb-4" onClick={() => setOpen(false)}>
            Apply
          </Button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
