"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { NavItem } from "@/lib/nav-config";
import { MobileDrawerLinksList } from "./mobile-drawer-links-list";

interface MobileMenuDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: NavItem[];
}

/**
 * Off-canvas panel for the mobile-only "Menu" item — holds the
 * desktop-only links that don't fit in the 8-item mobile nav bar
 * (Food Academy, Export, Blog, About, Contact by default). `items`
 * comes from the parent Server Component chain (StorefrontLayout →
 * MobileNav), which resolves the published Mobile menu (STORY-052) and
 * falls back to nav-config.ts's static defaults until one's been
 * published. Focus trap, outside click, and Escape-to-close all come
 * from the underlying base-ui Dialog primitive (see
 * src/components/ui/sheet.tsx) — not hand-rolled.
 */
export function MobileMenuDrawer({ open, onOpenChange, items }: MobileMenuDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <MobileDrawerLinksList items={items} onItemClick={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  );
}
