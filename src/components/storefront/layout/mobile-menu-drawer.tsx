"use client";

import Link from "next/link";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { mobileDrawerItems } from "@/lib/nav-config";

interface MobileMenuDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Off-canvas panel for the mobile-only "Menu" item — holds the
 * desktop-only links that don't fit in the 8-item mobile nav bar
 * (Food Academy, Export, Blog, About, Contact). Focus trap, outside
 * click, and Escape-to-close all come from the underlying base-ui
 * Dialog primitive (see src/components/ui/sheet.tsx) — not hand-rolled.
 */
export function MobileMenuDrawer({ open, onOpenChange }: MobileMenuDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <nav aria-label="More" className="flex flex-col gap-1 px-4 pb-4">
          {mobileDrawerItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-body hover:bg-muted"
            >
              <item.icon className="size-5" aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
