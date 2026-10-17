"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  bulkSetExportVisibility,
  fetchExportCatalogueAdminProducts,
  type ProductStatusValue,
} from "@/lib/api/admin-export-catalogue-client";

const STATUS_OPTIONS: ProductStatusValue[] = ["Draft", "Published", "Archived", "Discontinued", "OutOfSeason", "Review"];

/**
 * Phase 6. A dedicated list for Export Managers who may not have
 * `Products` access at all — enable/disable export visibility in bulk
 * without touching the retail product's own status. Description/
 * featured/display-order live on the main product editor's "Export &
 * Wholesale" tab, not duplicated here.
 */
export function AdminExportCatalogueView() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProductStatusValue | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState<string | null>(null);

  const filters = { search: search || undefined, status, page };
  const { data, isLoading } = useQuery({
    queryKey: ["admin-export-catalogue-products", filters],
    queryFn: () => fetchExportCatalogueAdminProducts(filters),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const allSelected = items.length > 0 && items.every((item) => selected.has(item.id));

  function toggleSelectAll() {
    setSelected((prev) => {
      if (allSelected) return new Set();
      const next = new Set(prev);
      for (const item of items) next.add(item.id);
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkVisibility(isExportEnabled: boolean) {
    setError(null);
    const ids = Array.from(selected);
    try {
      const result = await bulkSetExportVisibility(ids, isExportEnabled);
      setAnnouncement(`${result.updatedCount} of ${ids.length} product${ids.length === 1 ? "" : "s"} ${isExportEnabled ? "enabled" : "disabled"} for export.`);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["admin-export-catalogue-products"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update export visibility.");
    }
  }

  return (
    <div>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <div className="flex items-center justify-between">
        <h1 className="text-h2 font-heading text-charcoal">Export Catalogue</h1>
        <Button type="button" variant="outline" nativeButton={false} render={<Link href="/admin/export/settings" />}>
          Catalogue Settings
        </Button>
      </div>
      <p className="mt-1 text-small text-charcoal/70">
        Enable or disable a product&apos;s visibility on the public Export &amp; Wholesale catalogue without affecting
        its retail status. Description, featured flag, and display order are set on the product&apos;s own
        &quot;Export &amp; Wholesale&quot; tab.
      </p>

      {error && <p className="mt-2 text-small text-destructive">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search name or SKU"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="w-64"
        />
        <Select
          value={status ?? "all"}
          onValueChange={(value) => {
            setStatus(value === "all" ? undefined : (value as ProductStatusValue));
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selected.size > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-input bg-muted/50 px-3 py-2">
          <span className="text-small text-charcoal/70">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => handleBulkVisibility(true)}>
            Enable for export
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleBulkVisibility(false)}>
            Disable for export
          </Button>
        </div>
      )}

      <div className="mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} aria-label="Select all" />
              </TableHead>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Export visibility</TableHead>
              <TableHead>Featured</TableHead>
              <TableHead />
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
                  No products found.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const image = item.images[0];
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} aria-label={`Select ${item.name}`} />
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/products/${item.id}`} className="flex items-center gap-2 hover:underline">
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail only, not a storefront image
                          <img src={image.url} alt={image.altText ?? item.name} className="size-8 rounded object-cover" />
                        ) : (
                          <span className="size-8 rounded bg-muted" />
                        )}
                        <span className="font-medium text-charcoal">{item.name}</span>
                      </Link>
                    </TableCell>
                    <TableCell>{item.sku}</TableCell>
                    <TableCell>
                      <Badge variant={item.status === "Published" ? "default" : item.status === "Archived" ? "secondary" : "outline"}>{item.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.isExportEnabled ? "default" : "outline"}>{item.isExportEnabled ? "Enabled" : "Disabled"}</Badge>
                    </TableCell>
                    <TableCell>{item.isExportFeatured ? "Yes" : "—"}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" nativeButton={false} render={<Link href={`/admin/products/${item.id}`} />}>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            Previous
          </Button>
          <span className="text-small text-charcoal/70">
            Page {page} of {totalPages}
          </span>
          <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
