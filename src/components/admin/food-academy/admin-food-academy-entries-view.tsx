"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { FoodAcademyFeaturedReorderPanel } from "@/components/admin/food-academy/food-academy-featured-reorder-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchFoodAcademyEntries, fetchFoodAcademyEntryReferenceData, type FoodAcademyEntryStatus } from "@/lib/api/admin-food-academy-client";

const PAGE_SIZE = 20;
const STATUS_OPTIONS: FoodAcademyEntryStatus[] = ["Draft", "Published"];

export function AdminFoodAcademyEntriesView() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<FoodAcademyEntryStatus | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [showReorder, setShowReorder] = useState(false);

  const { data: referenceData } = useQuery({ queryKey: ["admin-food-academy-entry-reference-data"], queryFn: fetchFoodAcademyEntryReferenceData });

  const filters = { page, pageSize: PAGE_SIZE, status, categoryId, search: search || undefined };
  const { data, isLoading } = useQuery({ queryKey: ["admin-food-academy-entries", filters], queryFn: () => fetchFoodAcademyEntries(filters) });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (showReorder) {
    return <FoodAcademyFeaturedReorderPanel onBack={() => setShowReorder(false)} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-h3 font-heading text-charcoal">Entries</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowReorder(true)}>
            Reorder featured
          </Button>
          <Button nativeButton={false} render={<Link href="/admin/food-academy/entries/new" />}>
            New entry
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search title"
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
            setStatus(value === "all" ? undefined : (value as FoodAcademyEntryStatus));
            setPage(1);
          }}
        >
          <SelectTrigger>
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
        <Select
          value={categoryId ?? "all"}
          onValueChange={(value) => {
            setCategoryId(!value || value === "all" ? undefined : value);
            setPage(1);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {(referenceData?.categories ?? []).map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entry</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Featured</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-charcoal/70">
                  Loading…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-charcoal/70">
                  No entries found.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link href={`/admin/food-academy/entries/${item.id}`} className="font-medium text-charcoal hover:underline">
                      {item.title}
                    </Link>
                  </TableCell>
                  <TableCell>{item.category.name}</TableCell>
                  <TableCell>{item.contentType}</TableCell>
                  <TableCell>
                    <Badge variant={item.status === "Published" ? "default" : "outline"}>{item.status}</Badge>
                  </TableCell>
                  <TableCell>{item.isFeatured ? "Yes" : ""}</TableCell>
                  <TableCell>{new Date(item.updatedAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))
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
