import Link from "next/link";
import { cn } from "@/lib/utils";

interface DownloadPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  buildHref: (page: number) => string;
}

export function DownloadPagination({ page, pageSize, total, buildHref }: DownloadPaginationProps) {
  const pageCount = Math.ceil(total / pageSize);
  if (pageCount <= 1) return null;

  const pages = Array.from({ length: pageCount }, (_, index) => index + 1);

  return (
    <nav aria-label="Downloads pagination" className="mt-10 flex items-center justify-center gap-2">
      {page > 1 && (
        <Link href={buildHref(page - 1)} className="rounded-full border border-input px-3 py-1.5 text-small">
          Previous
        </Link>
      )}
      {pages.map((p) => (
        <Link
          key={p}
          href={buildHref(p)}
          aria-current={p === page ? "page" : undefined}
          className={cn("rounded-full border px-3 py-1.5 text-small", p === page ? "border-chilli bg-chilli text-white" : "border-input")}
        >
          {p}
        </Link>
      ))}
      {page < pageCount && (
        <Link href={buildHref(page + 1)} className="rounded-full border border-input px-3 py-1.5 text-small">
          Next
        </Link>
      )}
    </nav>
  );
}
