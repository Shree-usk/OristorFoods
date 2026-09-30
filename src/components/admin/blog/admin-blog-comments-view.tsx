"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  approveBlogComment,
  bulkModerateBlogComments,
  deleteBlogComment,
  fetchAdminBlogComments,
  hideBlogComment,
  rejectBlogComment,
  type BlogCommentStatus,
} from "@/lib/api/admin-blog-client";

const PAGE_SIZE = 20;

const STATUS_OPTIONS: BlogCommentStatus[] = ["Pending", "Approved", "Rejected", "Hidden"];

const STATUS_VARIANT: Record<BlogCommentStatus, "default" | "secondary" | "outline" | "destructive"> = {
  Pending: "secondary",
  Approved: "default",
  Rejected: "destructive",
  Hidden: "outline",
};

/** STORY-044. Wraps blog.service.ts's canTransitionComment/changeCommentStatus (built for STORY-021, left unwired) with an admin queue and bulk actions. A blog-scoped queue, not the unified across-source console STORY-045 will build later. */
export function AdminBlogCommentsView() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<BlogCommentStatus | undefined>("Pending");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  const filters = { page, pageSize: PAGE_SIZE, status, search: search || undefined };

  const { data, isLoading } = useQuery({
    queryKey: ["admin-blog-comments", filters],
    queryFn: () => fetchAdminBlogComments(filters),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-blog-comments"] });
  }

  async function runAction(fn: () => Promise<unknown>) {
    setActionError(null);
    try {
      await fn();
      refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Action failed.");
    }
  }

  async function runBulk(action: "approve" | "reject") {
    setActionError(null);
    try {
      await bulkModerateBlogComments(Array.from(selected), action);
      setSelected(new Set());
      refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Bulk action failed.");
    }
  }

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-h2 font-heading text-charcoal">Blog Comments</h1>
        <Button variant="outline" nativeButton={false} render={<Link href="/admin/blog/posts" />}>
          Back to posts
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search comment text"
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
            setStatus(value === "all" ? undefined : (value as BlogCommentStatus));
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
        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-small text-charcoal/70">{selected.size} selected</span>
            <Button type="button" size="sm" variant="outline" onClick={() => runBulk("approve")}>
              Approve selected
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => runBulk("reject")}>
              Reject selected
            </Button>
          </div>
        )}
      </div>
      {actionError && <p className="mt-2 text-small text-destructive">{actionError}</p>}

      <div className="mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Comment</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Post</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Actions</TableHead>
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
                  No comments found.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(item.id)}
                      onCheckedChange={() => toggleSelected(item.id)}
                      aria-label={`Select comment by ${item.authorName}`}
                    />
                  </TableCell>
                  <TableCell className="max-w-sm truncate">{item.body}</TableCell>
                  <TableCell>{item.authorName}</TableCell>
                  <TableCell>
                    <Link href={`/admin/blog/posts/${item.post.id}`} className="text-charcoal hover:underline">
                      {item.post.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[item.status]}>{item.status}</Badge>
                  </TableCell>
                  <TableCell>{new Date(item.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {item.status === "Pending" && (
                        <>
                          <Button type="button" size="sm" variant="ghost" onClick={() => runAction(() => approveBlogComment(item.id))}>
                            Approve
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => runAction(() => rejectBlogComment(item.id))}>
                            Reject
                          </Button>
                        </>
                      )}
                      {item.status === "Approved" && (
                        <Button type="button" size="sm" variant="ghost" onClick={() => runAction(() => hideBlogComment(item.id))}>
                          Hide
                        </Button>
                      )}
                      <Button type="button" size="sm" variant="ghost" onClick={() => runAction(() => deleteBlogComment(item.id))}>
                        Delete
                      </Button>
                    </div>
                  </TableCell>
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
