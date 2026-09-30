"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchAdminRecipes, type RecipeAdminStatus } from "@/lib/api/admin-recipe-client";

const PAGE_SIZE = 20;

const STATUS_OPTIONS: RecipeAdminStatus[] = ["Draft", "Review", "Approved", "Published", "Archived"];

const STATUS_VARIANT: Record<RecipeAdminStatus, "default" | "secondary" | "outline"> = {
  Draft: "outline",
  Review: "secondary",
  Approved: "secondary",
  Published: "default",
  Archived: "outline",
};

export function AdminRecipeListView() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<RecipeAdminStatus | undefined>(undefined);
  const [search, setSearch] = useState("");

  const filters = { page, pageSize: PAGE_SIZE, status, search: search || undefined };

  const { data, isLoading } = useQuery({
    queryKey: ["admin-recipes", filters],
    queryFn: () => fetchAdminRecipes(filters),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-h2 font-heading text-charcoal">Recipes</h1>
        <Button nativeButton={false} render={<Link href="/admin/recipes/new" />}>
          New recipe
        </Button>
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
            setStatus(value === "all" ? undefined : (value as RecipeAdminStatus));
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
      </div>

      <div className="mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recipe</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-charcoal/70">
                  Loading…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-charcoal/70">
                  No recipes found.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Link href={`/admin/recipes/${item.id}`} className="font-medium text-charcoal hover:underline">
                      {item.title}
                    </Link>
                  </TableCell>
                  <TableCell>{item.category.name}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[item.status]}>{item.status}</Badge>
                  </TableCell>
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
