"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchMyReviewQueue } from "@/lib/api/admin-cms-client";

/**
 * STORY-053 (additive scope). A flat, cross-content-type queue —
 * mirrors admin-reviews-queue-view.tsx's established shape (a
 * sourceType column over independently-sourced rows, not one shared
 * status machine). Only Recipe contributes today; see
 * review-queue.service.ts's QUEUE_SOURCES for how a future content
 * type joins this list.
 */
export function AdminReviewQueueView() {
  const { data: items, isLoading } = useQuery({ queryKey: ["admin-cms-my-queue"], queryFn: fetchMyReviewQueue });

  return (
    <div>
      <h1 className="text-h2 font-heading text-charcoal">My review queue</h1>
      <p className="mt-1 text-small text-muted-foreground">Items across content types awaiting your review action.</p>

      <div className="mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Title</TableHead>
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
            ) : (items ?? []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-charcoal/70">
                  Nothing awaiting your review.
                </TableCell>
              </TableRow>
            ) : (
              (items ?? []).map((item) => (
                <TableRow key={`${item.sourceType}:${item.id}`}>
                  <TableCell>
                    <Badge variant="outline">{item.sourceType}</Badge>
                  </TableCell>
                  <TableCell>
                    <Link href={item.href} className="font-medium text-charcoal hover:underline">
                      {item.title}
                    </Link>
                  </TableCell>
                  <TableCell>{item.status}</TableCell>
                  <TableCell>{new Date(item.updatedAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
