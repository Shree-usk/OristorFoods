import type { ReactNode } from "react";

interface FilterSidebarProps {
  /** Accessible name for the landmark, e.g. "Filter products". */
  label: string;
  children: ReactNode;
}

/** Desktop (lg and up) filter column. Pairs with FilterDrawer on mobile. */
export function FilterSidebar({ label, children }: FilterSidebarProps) {
  return (
    <aside className="hidden w-64 shrink-0 lg:block" aria-label={label}>
      {children}
    </aside>
  );
}
