"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import { createFeatureFlag, deleteFeatureFlag, fetchFeatureFlags, updateFeatureFlag } from "@/lib/api/admin-system-settings-client";

const EMPTY_FLAG = { key: "", description: "" };

/** STORY-054. Toggling here takes effect immediately for any code calling system-settings.service.ts::isFeatureEnabled(key) — no deploy required. */
export function FeatureFlagsPanel() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [newFlag, setNewFlag] = useState(EMPTY_FLAG);

  const { data } = useQuery({ queryKey: ["admin-settings-feature-flags"], queryFn: fetchFeatureFlags });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-settings-feature-flags"] });
  }

  async function handleToggle(id: string, enabled: boolean) {
    setError(null);
    try {
      await updateFeatureFlag(id, { enabled });
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update the feature flag.");
    }
  }

  async function handleAdd() {
    setError(null);
    try {
      await createFeatureFlag({ key: newFlag.key, enabled: false, description: newFlag.description || null });
      setNewFlag(EMPTY_FLAG);
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add the feature flag.");
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    try {
      await deleteFeatureFlag(id);
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove the feature flag.");
    }
  }

  return (
    <div className="max-w-2xl">
      {error && <p className="mb-2 text-small text-destructive">{error}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Enabled</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data ?? []).map((flag) => (
            <TableRow key={flag.id}>
              <TableCell>{flag.key}</TableCell>
              <TableCell>{flag.description ?? "—"}</TableCell>
              <TableCell>
                <CheckboxOption label="Enabled" checked={flag.enabled} onCheckedChange={(checked) => handleToggle(flag.id, checked)} />
              </TableCell>
              <TableCell>
                <Button size="sm" variant="destructive" onClick={() => handleRemove(flag.id)}>
                  Remove
                </Button>
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell>
              <Input placeholder="e.g. new_checkout_flow" value={newFlag.key} onChange={(event) => setNewFlag((prev) => ({ ...prev, key: event.target.value }))} />
            </TableCell>
            <TableCell>
              <Input placeholder="Description (optional)" value={newFlag.description} onChange={(event) => setNewFlag((prev) => ({ ...prev, description: event.target.value }))} />
            </TableCell>
            <TableCell colSpan={2}>
              <Button size="sm" onClick={handleAdd} disabled={!newFlag.key.trim()}>
                Add
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
