import type { ComponentProps } from "react";

import { FilterControls } from "./filter-controls";

export function FilterSidebar(props: ComponentProps<typeof FilterControls>) {
  return (
    <aside className="hidden w-64 shrink-0 lg:block" aria-label="Filter products">
      <FilterControls {...props} />
    </aside>
  );
}
