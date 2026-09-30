"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  createDraftLayout,
  deleteDraftLayout,
  fetchHomepageLayouts,
  publishLayout,
  rollbackToPrevious,
  type HomepageLayoutStatus,
} from "@/lib/api/admin-homepage-builder-client";

const STATUS_VARIANT: Record<HomepageLayoutStatus, "default" | "secondary" | "outline"> = {
  Published: "default",
  Draft: "secondary",
  Archived: "outline",
};

export function HomepageBuilderListView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const { data: layouts, isLoading } = useQuery({
    queryKey: ["homepage-builder-layouts"],
    queryFn: () => fetchHomepageLayouts(),
  });

  const hasPublished = (layouts ?? []).some((layout) => layout.status === "Published");
  const hasArchived = (layouts ?? []).some((layout) => layout.status === "Archived");

  async function handleNewDraft(cloneFromPublished: boolean) {
    setError(null);
    try {
      const layout = await createDraftLayout(cloneFromPublished);
      router.push(`/admin/homepage-builder/${layout.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create draft.");
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    setPending(id);
    try {
      await deleteDraftLayout(id);
      queryClient.invalidateQueries({ queryKey: ["homepage-builder-layouts"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete draft.");
    } finally {
      setPending(null);
    }
  }

  async function handlePublish(id: string) {
    setError(null);
    setPending(id);
    try {
      await publishLayout(id);
      queryClient.invalidateQueries({ queryKey: ["homepage-builder-layouts"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish layout.");
    } finally {
      setPending(null);
    }
  }

  async function handleRollback() {
    setError(null);
    setPending("rollback");
    try {
      await rollbackToPrevious();
      queryClient.invalidateQueries({ queryKey: ["homepage-builder-layouts"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to roll back.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-h2 font-heading text-charcoal">Homepage Builder</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => handleRollback()} disabled={!hasArchived || pending !== null}>
            Roll back
          </Button>
          <Button variant="outline" onClick={() => handleNewDraft(true)} disabled={!hasPublished}>
            New draft from published
          </Button>
          <Button onClick={() => handleNewDraft(false)}>New blank draft</Button>
        </div>
      </div>

      {error && <p className="mt-4 text-small text-chilli">{error}</p>}

      <div className="mt-6 divide-y divide-border rounded-md border border-border">
        {isLoading && <p className="p-4 text-small text-muted-foreground">Loading…</p>}
        {!isLoading && (layouts ?? []).length === 0 && <p className="p-4 text-small text-muted-foreground">No layouts yet — create a draft to get started.</p>}
        {(layouts ?? []).map((layout) => (
          <div key={layout.id} className="flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <Badge variant={STATUS_VARIANT[layout.status]}>{layout.status}</Badge>
              <span className="text-small text-charcoal">{layout.sections.length} sections</span>
              <span className="text-small text-muted-foreground">Updated {new Date(layout.updatedAt).toLocaleString()}</span>
            </div>
            <div className="flex gap-2">
              {layout.status === "Draft" && (
                <>
                  <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/admin/homepage-builder/${layout.id}`} />}>
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/admin/homepage-builder/${layout.id}/preview`} />}>
                    Preview
                  </Button>
                  <Button size="sm" onClick={() => handlePublish(layout.id)} disabled={pending !== null}>
                    Publish
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(layout.id)} disabled={pending !== null}>
                    Delete
                  </Button>
                </>
              )}
              {layout.status !== "Draft" && (
                <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/admin/homepage-builder/${layout.id}/preview`} />}>
                  View
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
