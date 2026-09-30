"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  bulkChangeAdminProductStatus,
  bulkDeleteAdminProducts,
  fetchAdminProducts,
  fetchProductFormReferenceData,
} from "@/lib/api/admin-product-client";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "Draft", label: "Draft" },
  { value: "Published", label: "Published" },
  { value: "Archived", label: "Archived" },
];

const STOCK_OPTIONS = [
  { value: "in_stock", label: "In stock" },
  { value: "low_stock", label: "Low stock" },
  { value: "out_of_stock", label: "Out of stock" },
];

function formatCurrency(amount: string, currency: string): string {
  return `${currency} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function AdminProductListView() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [stockLevel, setStockLevel] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [announcement, setAnnouncement] = useState("");

  const filters = { page, pageSize: PAGE_SIZE, status, categoryId, stockLevel: stockLevel as "in_stock" | "low_stock" | "out_of_stock" | undefined, search: search || undefined };

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products", filters],
    queryFn: () => fetchAdminProducts(filters),
  });

  const { data: referenceData } = useQuery({
    queryKey: ["admin-products-reference-data"],
    queryFn: fetchProductFormReferenceData,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
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

  async function handleBulkStatus(nextStatus: "Published" | "Archived") {
    const ids = Array.from(selected);
    const result = await bulkChangeAdminProductStatus(ids, nextStatus);
    setAnnouncement(`${result.succeeded.length} of ${ids.length} product${ids.length === 1 ? "" : "s"} updated.`);
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ["admin-products"] });
  }

  async function handleBulkDelete() {
    const ids = Array.from(selected);
    const result = await bulkDeleteAdminProducts(ids);
    setAnnouncement(`${result.succeeded.length} of ${ids.length} product${ids.length === 1 ? "" : "s"} deleted.`);
    setSelected(new Set());
    queryClient.invalidateQueries({ queryKey: ["admin-products"] });
  }

  const categoryOptions = useMemo(() => referenceData?.categories ?? [], [referenceData]);

  return (
    <div>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <div className="flex items-center justify-between">
        <h1 className="text-h2 font-heading text-charcoal">Products</h1>
        <Button nativeButton={false} render={<Link href="/admin/products/new" />}>
          New product
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search name, SKU, or barcode"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="w-64"
        />
        <Select value={status ?? "all"} onValueChange={(value) => { setStatus(value === "all" ? undefined : (value as string)); setPage(1); }}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryId ?? "all"} onValueChange={(value) => { setCategoryId(value === "all" ? undefined : (value as string)); setPage(1); }}>
          <SelectTrigger>
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categoryOptions.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stockLevel ?? "all"} onValueChange={(value) => { setStockLevel(value === "all" ? undefined : (value as string)); setPage(1); }}>
          <SelectTrigger>
            <SelectValue placeholder="Stock level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stock levels</SelectItem>
            {STOCK_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selected.size > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-input bg-muted/50 px-3 py-2">
          <span className="text-small text-charcoal/70">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => handleBulkStatus("Published")}>
            Publish
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleBulkStatus("Archived")}>
            Archive
          </Button>
          <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
            Delete
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
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-charcoal/70">
                  Loading…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-charcoal/70">
                  No products found.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const price = item.standardPrices[0];
                const image = item.images[0];
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleSelect(item.id)} aria-label={`Select ${item.name}`} />
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/products/${item.id}`} className="flex items-center gap-2 hover:underline">
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={image.url} alt={image.altText ?? item.name} className="size-8 rounded object-cover" />
                        ) : (
                          <span className="size-8 rounded bg-muted" />
                        )}
                        <span className="font-medium text-charcoal">{item.name}</span>
                      </Link>
                    </TableCell>
                    <TableCell>{item.sku}</TableCell>
                    <TableCell>{item.categories.map((category) => category.name).join(", ") || "—"}</TableCell>
                    <TableCell>{price ? formatCurrency(price.price, price.currency) : "—"}</TableCell>
                    <TableCell>{item.inStock ? item.stockQuantity : "Out of stock"}</TableCell>
                    <TableCell>
                      <Badge variant={item.status === "Published" ? "default" : item.status === "Archived" ? "secondary" : "outline"}>{item.status}</Badge>
                    </TableCell>
                    <TableCell>{new Date(item.updatedAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination className="mt-4">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink isActive>{page}</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
