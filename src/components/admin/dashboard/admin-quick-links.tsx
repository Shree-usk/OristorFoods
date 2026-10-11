"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowRight, Plus, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { AdminNavGroup, AdminNavLink } from "@/lib/admin-nav-registry";

/**
 * The real, in-app version of the admin link-launcher — a grouped,
 * filterable jump list into every module the signed-in admin's role can
 * actually reach. `quickAdd`/`groups` arrive already permission-filtered
 * server-side (page.tsx); the text filter here is purely client-side
 * narrowing on top of that already-authorized set.
 */
export function AdminQuickLinks({ quickAdd, groups }: { quickAdd: AdminNavLink[]; groups: AdminNavGroup[] }) {
  const [term, setTerm] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const normalized = term.trim().toLowerCase();

  const filteredQuickAdd = useMemo(
    () => quickAdd.filter((link) => normalized === "" || link.label.toLowerCase().includes(normalized)),
    [quickAdd, normalized],
  );
  const filteredGroups = useMemo(
    () =>
      groups
        .map((group) => ({ ...group, links: group.links.filter((link) => normalized === "" || link.label.toLowerCase().includes(normalized)) }))
        .filter((group) => group.links.length > 0),
    [groups, normalized],
  );

  const hasAnything = filteredQuickAdd.length > 0 || filteredGroups.length > 0;
  if (quickAdd.length === 0 && groups.length === 0) return null;

  return (
    <section
      onKeyDown={(event) => {
        if (event.key === "/" && document.activeElement !== inputRef.current) {
          event.preventDefault();
          inputRef.current?.focus();
        }
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-h3 font-heading text-charcoal">Quick Links</h2>
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-charcoal/40" aria-hidden="true" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Filter&hellip; (e.g. &quot;recipe&quot;)"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            className="h-9 pl-8"
          />
        </div>
      </div>

      {!hasAnything ? (
        <p className="mt-4 text-small text-charcoal/70">No shortcuts match &ldquo;{term}&rdquo;.</p>
      ) : (
        <>
          {filteredQuickAdd.length > 0 && (
            <div className="mt-4">
              <p className="text-small font-medium text-charcoal/70">Start a new one</p>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                {filteredQuickAdd.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex min-h-20 flex-col justify-between gap-2 rounded-lg bg-chilli p-3 text-ivory transition-transform hover:-translate-y-0.5"
                  >
                    <Plus className="size-5" aria-hidden="true" />
                    <span className="text-small font-medium">{link.label}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {filteredGroups.map((group) => (
            <div key={group.title} className="mt-6">
              <p className="text-small font-medium text-charcoal/70">{group.title}</p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="group flex items-center justify-between gap-2 rounded-lg border border-input px-3 py-2.5 text-small font-medium text-charcoal transition-colors hover:border-chilli hover:bg-chilli/5"
                  >
                    <span className="truncate">{link.label}</span>
                    <ArrowRight className="size-4 shrink-0 text-charcoal/40 transition-colors group-hover:text-chilli" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
