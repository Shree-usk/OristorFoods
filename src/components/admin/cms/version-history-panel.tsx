"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchVersionDiff, fetchVersions, rollbackToVersion, type VersionedEntityType } from "@/lib/api/admin-cms-client";

interface VersionHistoryPanelProps {
  entityType: VersionedEntityType;
  entityId: string;
  /**
   * Called with the restored entity after a successful restore. For
   * Recipe/BlogPost this is the SAME id, now reset to Draft — the
   * embedding screen should just refetch. For HomepageLayout, since
   * that content type is multi-row (Draft/Published/Archived are
   * separate rows), restoring creates a brand-new draft layout with
   * its OWN id — the embedding screen should navigate there instead.
   */
  onRestored?: (restored: { id: string }) => void;
}

/**
 * STORY-053 (additive scope). Embedded directly into Homepage Builder's,
 * Recipe's, and Blog's existing edit screens, next to their own status/
 * workflow UI — not a replacement for it. Every publish already creates
 * a version (see versioning.service.ts); this just lets an admin browse,
 * diff, and restore them.
 */
export function VersionHistoryPanel({ entityType, entityId, onRestored }: VersionHistoryPanelProps) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<[string, string] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: versions, isLoading } = useQuery({
    queryKey: ["admin-cms-versions", entityType, entityId],
    queryFn: () => fetchVersions(entityType, entityId),
  });

  const { data: diff } = useQuery({
    queryKey: ["admin-cms-version-diff", entityType, entityId, selected],
    queryFn: () => fetchVersionDiff(entityType, entityId, selected![0], selected![1]),
    enabled: selected !== null,
  });

  function toggleSelect(versionId: string) {
    setSelected((prev) => {
      if (!prev) return [versionId, versionId];
      if (prev.includes(versionId)) return null;
      return [prev[1], versionId];
    });
  }

  async function handleRestore(versionId: string) {
    setError(null);
    try {
      const restored = await rollbackToVersion(entityType, entityId, versionId);
      queryClient.invalidateQueries({ queryKey: ["admin-cms-versions", entityType, entityId] });
      onRestored?.(restored as { id: string });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore this version.");
    }
  }

  if (isLoading) return <p className="text-small text-muted-foreground">Loading version history…</p>;

  return (
    <div className="rounded-md border border-border p-4">
      <p className="text-small font-medium text-charcoal">Version history</p>
      <p className="mt-1 text-caption text-muted-foreground">Select two versions to compare. Restoring brings a version back as a new Draft — it won&apos;t go live until published again.</p>
      {error && <p className="mt-2 text-small text-destructive">{error}</p>}

      <ul className="mt-3 divide-y divide-border">
        {(versions ?? []).map((version) => (
          <li key={version.id} className="flex items-center justify-between gap-3 py-2">
            <label className="flex items-center gap-2 text-small">
              <input type="checkbox" checked={selected?.includes(version.id) ?? false} onChange={() => toggleSelect(version.id)} />
              Version {version.versionNumber} — {new Date(version.createdAt).toLocaleString()}
            </label>
            <Button size="sm" variant="outline" onClick={() => handleRestore(version.id)}>
              Restore as draft
            </Button>
          </li>
        ))}
        {(versions ?? []).length === 0 && <li className="py-2 text-small text-muted-foreground">No versions yet — publishing creates one.</li>}
      </ul>

      {diff && (
        <div className="mt-4 rounded-md border border-dashed border-border p-3">
          <p className="text-small font-medium text-charcoal">Changes</p>
          {diff.length === 0 ? (
            <p className="mt-1 text-small text-muted-foreground">No differences between these two versions.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-small">
              {diff.map((entry) => (
                <li key={entry.path}>
                  <span className="font-medium text-charcoal">{entry.path || "(root)"}</span>: {JSON.stringify(entry.before)} → {JSON.stringify(entry.after)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
