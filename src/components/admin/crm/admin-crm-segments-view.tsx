"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deleteSegment, fetchSegments, type SavedSegment } from "@/lib/api/admin-crm-client";

/** STORY-059a. */
export function AdminCrmSegmentsView() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedSegment | null>(null);

  const { data: segments } = useQuery({ queryKey: ["admin-crm-segments"], queryFn: fetchSegments });

  async function handleDelete() {
    if (!deleteTarget) return;
    setActionError(null);
    try {
      await deleteSegment(deleteTarget.id);
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["admin-crm-segments"] });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to delete the segment.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-h2 font-heading text-charcoal">CRM Segments</h1>
        <Button type="button" nativeButton={false} render={<Link href="/admin/crm/new" />}>
          New segment
        </Button>
      </div>

      {actionError && <p className="mt-3 text-small text-destructive">{actionError}</p>}

      <Table className="mt-6">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Created by</TableHead>
            <TableHead>Created</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {(segments ?? []).map((segment) => (
            <TableRow key={segment.id}>
              <TableCell>{segment.name}</TableCell>
              <TableCell>{segment.createdBy.name}</TableCell>
              <TableCell>{new Date(segment.createdAt).toLocaleDateString()}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/admin/crm/${segment.id}`} />}>
                    Edit
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(segment)}>
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <h2 className="text-h4 font-heading text-charcoal">Delete &ldquo;{deleteTarget?.name}&rdquo;?</h2>
          <p className="mt-2 text-small text-charcoal/70">Any campaign targeting this segment will stop having an audience. This cannot be undone.</p>
          <Button type="button" variant="destructive" className="mt-4 w-fit" onClick={handleDelete}>
            Delete segment
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
