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
import { deriveEffectiveStatus } from "@/lib/blog-post-status";
import { fetchAdminBlogPosts, type BlogPostAdminStatusFilter } from "@/lib/api/admin-blog-client";

const PAGE_SIZE = 20;

const STATUS_OPTIONS: BlogPostAdminStatusFilter[] = ["Draft", "Scheduled", "Live", "Archived"];

const STATUS_VARIANT: Record<BlogPostAdminStatusFilter, "default" | "secondary" | "outline"> = {
  Draft: "outline",
  Scheduled: "secondary",
  Live: "default",
  Archived: "outline",
};

export function AdminBlogPostListView() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<BlogPostAdminStatusFilter | undefined>(undefined);
  const [search, setSearch] = useState("");

  const filters = { page, pageSize: PAGE_SIZE, status, search: search || undefined };

  const { data, isLoading } = useQuery({
    queryKey: ["admin-blog-posts", filters],
    queryFn: () => fetchAdminBlogPosts(filters),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-h2 font-heading text-charcoal">Blog</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href="/admin/blog/comments" />}>
            Comments
          </Button>
          <Button nativeButton={false} render={<Link href="/admin/blog/posts/new" />}>
            New post
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
            setStatus(value === "all" ? undefined : (value as BlogPostAdminStatusFilter));
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
              <TableHead>Post</TableHead>
              <TableHead>Author</TableHead>
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
                  No posts found.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const effectiveStatus = deriveEffectiveStatus(item.status, item.publishedAt);
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Link href={`/admin/blog/posts/${item.id}`} className="font-medium text-charcoal hover:underline">
                        {item.title}
                      </Link>
                    </TableCell>
                    <TableCell>{item.author.name}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[effectiveStatus]}>{effectiveStatus}</Badge>
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
