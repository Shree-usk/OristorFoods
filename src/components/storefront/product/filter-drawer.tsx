"use client";

import { useState, type ComponentProps } from "react";
import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FilterControls } from "./filter-controls";

export function FilterDrawer(props: ComponentProps<typeof FilterControls>) {
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
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">
            <FilterControls {...props} />
          </div>
          <Button type="button" className="mx-4 mb-4" onClick={() => setOpen(false)}>
            Apply
          </Button>
        </SheetContent>
      </Sheet>
    </div>
  );
}
