"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AssetDetailPanel } from "@/components/admin/media/asset-detail-panel";
import { AssetThumbnail } from "@/components/admin/media/asset-thumbnail";
import { FolderTree } from "@/components/admin/media/folder-tree";
import {
  createMediaFolder,
  fetchMediaAssets,
  fetchMediaFolderTree,
  fetchMediaTags,
  selectMediaAsset,
  uploadMediaAssets,
  type MediaAsset,
} from "@/lib/api/admin-media-client";

const PAGE_SIZE = 24;
const TYPE_OPTIONS = [
  { value: "Image", label: "Images" },
  { value: "Video", label: "Videos" },
  { value: "Document", label: "Documents" },
] as const;

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface MediaAssetBrowserProps {
  /** "manage" shows the upload dropzone and opens AssetDetailPanel on click; "picker" (AssetPickerDialog) selects an asset instead. */
  mode: "manage" | "picker";
  onSelect?: (asset: MediaAsset) => void;
}

export function MediaAssetBrowser({ mode, onSelect }: MediaAssetBrowserProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [folderId, setFolderId] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"Image" | "Video" | "Document" | undefined>(undefined);
  const [tagId, setTagId] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [detailAssetId, setDetailAssetId] = useState<string | null>(null);
  const [uploadErrors, setUploadErrors] = useState<{ originalName: string; reason: string }[]>([]);
  const [selectError, setSelectError] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");

  const filters = { page, pageSize: PAGE_SIZE, folderId, search: search || undefined, type, tagId };
  const { data, isLoading } = useQuery({ queryKey: ["admin-media", filters], queryFn: () => fetchMediaAssets(filters) });
  const { data: folderTree } = useQuery({ queryKey: ["admin-media-folders"], queryFn: fetchMediaFolderTree });
  const { data: tags } = useQuery({ queryKey: ["admin-media-tags"], queryFn: fetchMediaTags });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-media"] });
    queryClient.invalidateQueries({ queryKey: ["admin-media-tags"] });
  }

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadErrors([]);
    const result = await uploadMediaAssets(Array.from(files), { folderId });
    if (result.failed.length > 0) setUploadErrors(result.failed);
    invalidate();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    await createMediaFolder(newFolderName.trim(), folderId ?? null);
    setNewFolderName("");
    queryClient.invalidateQueries({ queryKey: ["admin-media-folders"] });
  }

  async function handleAssetClick(asset: MediaAsset) {
    if (mode === "manage") {
      setDetailAssetId(asset.id);
      return;
    }
    setSelectError(null);
    try {
      const selected = await selectMediaAsset(asset.id);
      onSelect?.(selected);
    } catch (error) {
      setSelectError(
        error instanceof Error && error.message.includes("alt text")
          ? `"${asset.originalName}" needs alt text before it can be selected — open it to add one.`
          : "Could not select this asset.",
      );
      setDetailAssetId(asset.id);
    }
  }

  return (
    <div className="flex gap-4">
      <aside className="w-56 shrink-0">
        <Button type="button" variant={folderId === undefined ? "secondary" : "ghost"} size="sm" className="w-full justify-start" onClick={() => setFolderId(undefined)}>
          All folders
        </Button>
        {folderTree && <FolderTree nodes={folderTree} selectedFolderId={folderId} onSelect={setFolderId} />}
        {mode === "manage" && (
          <div className="mt-3 flex gap-1">
            <Input placeholder="New folder" value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} className="h-7 text-xs" />
            <Button type="button" size="sm" variant="outline" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              Add
            </Button>
          </div>
        )}
      </aside>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Search filename"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="w-56"
          />
          <Select value={type ?? "all"} onValueChange={(value) => { setType(value === "all" ? undefined : (value as typeof type)); setPage(1); }}>
            <SelectTrigger>
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tagId ?? "all"} onValueChange={(value) => { setTagId(value === "all" ? undefined : (value as string)); setPage(1); }}>
            <SelectTrigger>
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              {(tags ?? []).map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  {tag.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {mode === "manage" && (
            <>
              <Label htmlFor="media-upload-input" className="sr-only">
                Upload files
              </Label>
              <Button type="button" size="sm" onClick={() => fileInputRef.current?.click()}>
                Upload
              </Button>
              <input
                ref={fileInputRef}
                id="media-upload-input"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,image/svg+xml,video/mp4,application/pdf"
                className="hidden"
                onChange={(event) => handleFilesSelected(event.target.files)}
              />
            </>
          )}
        </div>

        {uploadErrors.length > 0 && (
          <ul className="mt-2 text-small text-destructive">
            {uploadErrors.map((failure, index) => (
              <li key={index}>
                {failure.originalName}: {failure.reason}
              </li>
            ))}
          </ul>
        )}
        {selectError && <p className="mt-2 text-small text-destructive">{selectError}</p>}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {isLoading ? (
            <p className="col-span-full text-small text-charcoal/70">Loading…</p>
          ) : items.length === 0 ? (
            <p className="col-span-full text-small text-charcoal/70">No media found.</p>
          ) : (
            items.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => handleAssetClick(asset)}
                className="flex flex-col gap-1 rounded-lg border border-input p-1.5 text-left hover:border-ring"
              >
                <div className="aspect-square overflow-hidden rounded bg-muted">
                  <AssetThumbnail asset={asset} />
                </div>
                <p className="truncate text-caption text-charcoal" title={asset.originalName}>
                  {asset.originalName}
                </p>
                <div className="flex items-center justify-between text-caption text-charcoal/60">
                  <span>{formatSize(asset.sizeBytes)}</span>
                  {!asset.altText && (
                    <Badge variant="destructive" className="h-4 px-1 text-[0.65rem]">
                      No alt text
                    </Badge>
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              Previous
            </Button>
            <span className="text-small text-charcoal/70">
              Page {page} of {totalPages}
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
              Next
            </Button>
          </div>
        )}
      </div>

      {detailAssetId && (
        <AssetDetailPanel
          assetId={detailAssetId}
          open={Boolean(detailAssetId)}
          onOpenChange={(open) => {
            if (!open) setDetailAssetId(null);
          }}
          onChanged={invalidate}
          // Picker mode opens the panel only to fix a missing-alt-text
          // rejection — it never offers to delete the asset from there.
          allowDelete={mode === "manage"}
        />
      )}
    </div>
  );
}
