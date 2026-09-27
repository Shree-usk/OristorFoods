import Link from "next/link";

import { buildDownloadChipHref } from "@/lib/download-chip-href";
import { cn } from "@/lib/utils";
import type { DownloadCategorySummary } from "@/types/download";

export function DownloadCategoryFilter({ categories, activeCategory }: { categories: DownloadCategorySummary[]; activeCategory?: string }) {
  return (
    <nav aria-label="Filter by category" className="mt-8 flex flex-wrap gap-2">
      <Link
        href={buildDownloadChipHref({ category: activeCategory }, { category: undefined })}
        aria-current={!activeCategory ? "page" : undefined}
        className={cn("rounded-full border px-4 py-1.5 text-small", !activeCategory ? "border-chilli bg-chilli text-white" : "border-input")}
      >
        All resources
      </Link>
      {categories.map((category) => (
        <Link
          key={category.slug}
          href={buildDownloadChipHref({ category: activeCategory }, { category: category.slug })}
          aria-current={activeCategory === category.slug ? "page" : undefined}
          className={cn(
            "rounded-full border px-4 py-1.5 text-small",
            activeCategory === category.slug ? "border-chilli bg-chilli text-white" : "border-input",
          )}
        >
          {category.name}
        </Link>
      ))}
    </nav>
  );
}
