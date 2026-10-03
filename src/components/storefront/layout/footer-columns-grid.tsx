import Link from "next/link";

import type { FooterColumn } from "@/lib/footer-config";

/**
 * STORY-052. Extracted out of footer.tsx so the admin preview pane can
 * render this exact presentational markup against draft data too, not a
 * separate mock — footer.tsx uses it for the real, published footer.
 */
export function FooterColumnsGrid({ columns }: { columns: FooterColumn[] }) {
  return (
    <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
      {columns.map((column) => (
        <div key={column.heading}>
          <p className="text-small font-medium text-ivory">{column.heading}</p>
          <ul className="mt-3 space-y-2">
            {column.links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-small text-ivory/70 hover:text-ivory">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
