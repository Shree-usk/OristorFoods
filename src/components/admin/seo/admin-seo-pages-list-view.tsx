"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bulkApplyTitleTemplateAdmin, fetchSeoPages, type SeoPageRow } from "@/lib/api/seo-pages-admin-client";

type FilterId = "missingDescription" | "titleLength" | "ogImage" | "duplicateTitle";

const FILTER_OPTIONS: { id: FilterId; label: string }[] = [
  { id: "missingDescription", label: "Missing meta description" },
  { id: "titleLength", label: "Title length out of range" },
  { id: "ogImage", label: "Social image missing alt text or too small" },
  { id: "duplicateTitle", label: "Duplicate title" },
];

function rowKey(row: Pick<SeoPageRow, "entityType" | "entityId">): string {
  return `${row.entityType}:${row.entityId}`;
}

function matchesFilter(row: SeoPageRow, filter: FilterId): boolean {
  if (filter === "duplicateTitle") return row.isDuplicateTitle;
  if (filter === "missingDescription") return !row.health.find((check) => check.id === "missingDescription")?.ok;
  if (filter === "titleLength") return !row.health.find((check) => check.id === "titleLength")?.ok;
  return !row.health.find((check) => check.id === "missingOgAlt")?.ok || !row.health.find((check) => check.id === "ogImageTooSmall")?.ok;
}

/**
 * STORY-051d. The central, cross-entity-type SEO audit list — mirrors
 * admin-product-list-view.tsx's bulk-select pattern exactly, keyed by
 * "entityType:entityId" since rows span three different Prisma models.
 */
export function AdminSeoPagesListView() {
  const queryClient = useQueryClient();
  const [activeFilters, setActiveFilters] = useState<Set<FilterId>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [announcement, setAnnouncement] = useState("");
  const [template, setTemplate] = useState("{title} | Oristor");
  const [failures, setFailures] = useState<BulkApplyTitleTemplateResultFailure[]>([]);

  const { data: rows, isLoading } = useQuery({ queryKey: ["admin-seo-pages"], queryFn: fetchSeoPages });

  const items = (rows ?? []).filter((row) => activeFilters.size === 0 || [...activeFilters].some((filter) => matchesFilter(row, filter)));
  const allSelected = items.length > 0 && items.every((item) => selected.has(rowKey(item)));

  function toggleFilter(filter: FilterId) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filter)) next.delete(filter);
      else next.add(filter);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => {
      if (allSelected) return new Set();
      const next = new Set(prev);
      for (const item of items) next.add(rowKey(item));
      return next;
    });
  }

  function toggleSelect(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleApplyTemplate() {
    const refs = (rows ?? []).filter((row) => selected.has(rowKey(row))).map((row) => ({ entityType: row.entityType, entityId: row.entityId, title: row.title }));
    if (refs.length === 0 || !template.includes("{title}")) return;

    const result = await bulkApplyTitleTemplateAdmin(refs, template);
    setAnnouncement(`${result.succeeded.length} of ${refs.length} page${refs.length === 1 ? "" : "s"} updated.`);
    setFailures(result.failed);
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ["admin-seo-pages"] });
  }

  return (
    <div>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <h1 className="text-h2 font-heading text-charcoal">SEO pages</h1>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        {FILTER_OPTIONS.map((option) => (
          <div key={option.id} className="flex items-center gap-2">
            <Checkbox checked={activeFilters.has(option.id)} onCheckedChange={() => toggleFilter(option.id)} id={`seo-pages-filter-${option.id}`} />
            <label htmlFor={`seo-pages-filter-${option.id}`} className="text-small text-charcoal/80">
              {option.label}
            </label>
          </div>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-input bg-muted/50 px-3 py-2">
          <span className="text-small text-charcoal/70">{selected.size} selected</span>
          <Input value={template} onChange={(event) => setTemplate(event.target.value)} placeholder="{title} | Oristor" className="w-64" />
          <Button size="sm" variant="outline" onClick={handleApplyTemplate} disabled={!template.includes("{title}")}>
            Apply title template to selected
          </Button>
        </div>
      )}

      {failures.length > 0 && (
        <ul className="mt-2 space-y-1 text-small text-destructive">
          {failures.map((failure) => (
            <li key={rowKey(failure)}>
              {failure.entityType} {failure.entityId}: {failure.reason}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} aria-label="Select all" />
              </TableHead>
              <TableHead>Page</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Meta title</TableHead>
              <TableHead>Health</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-charcoal/70">
                  Loading…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-charcoal/70">
                  No pages found.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const key = rowKey(item);
                const failingChecks = item.health.filter((check) => !check.ok);
                return (
                  <TableRow key={key}>
                    <TableCell>
                      <Checkbox checked={selected.has(key)} onCheckedChange={() => toggleSelect(key)} aria-label={`Select ${item.title}`} />
                    </TableCell>
                    <TableCell>
                      <a href={item.url} target="_blank" rel="noreferrer" className="font-medium text-charcoal hover:underline">
                        {item.title}
                      </a>
                      {item.isDuplicateTitle && (
                        <Badge variant="outline" className="ml-2">
                          Duplicate title
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{item.entityType}</TableCell>
                    <TableCell>{item.status}</TableCell>
                    <TableCell className="max-w-64 truncate">{item.metaTitle ?? "—"}</TableCell>
                    <TableCell>
                      {failingChecks.length === 0 ? (
                        <span className="text-small text-charcoal/70">All checks pass</span>
                      ) : (
                        <span className="text-small text-destructive">{failingChecks.length} issue{failingChecks.length === 1 ? "" : "s"}</span>
                      )}
                    </TableCell>
                    <TableCell>{new Date(item.updatedAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

type BulkApplyTitleTemplateResultFailure = { entityType: SeoPageRow["entityType"]; entityId: string; reason: string };
