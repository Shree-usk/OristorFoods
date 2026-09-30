"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AssetThumbnail } from "@/components/admin/media/asset-thumbnail";
import { deleteMediaAsset, fetchMediaAsset, updateMediaAsset, type MediaAsset } from "@/lib/api/admin-media-client";

interface AssetDetailPanelProps {
  assetId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
  allowDelete: boolean;
}

export function AssetDetailPanel({ assetId, open, onOpenChange, onChanged, allowDelete }: AssetDetailPanelProps) {
  const { data: asset } = useQuery({ queryKey: ["admin-media-asset", assetId], queryFn: () => fetchMediaAsset(assetId), enabled: open });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{asset?.originalName ?? "Asset"}</SheetTitle>
        </SheetHeader>
        {/* `key={asset.id}` gives the form its own local state per asset, initialized directly from the loaded asset — no effect needed to sync it. */}
        {asset && <AssetDetailForm key={asset.id} asset={asset} onChanged={onChanged} onDeleted={() => onOpenChange(false)} allowDelete={allowDelete} />}
        <SheetFooter />
      </SheetContent>
    </Sheet>
  );
}

function AssetDetailForm({
  asset,
  onChanged,
  onDeleted,
  allowDelete,
}: {
  asset: MediaAsset;
  onChanged: () => void;
  onDeleted: () => void;
  allowDelete: boolean;
}) {
  const [altText, setAltText] = useState(asset.altText ?? "");
  const [tagInput, setTagInput] = useState(asset.tags.map((tag) => tag.name).join(", "));
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    try {
      const tagNames = tagInput
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);
      await updateMediaAsset(asset.id, { altText: altText || null, tagNames });
      onChanged();
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    await deleteMediaAsset(asset.id);
    onChanged();
    onDeleted();
  }

  return (
    <div className="flex flex-col gap-4 px-4">
      <div className="aspect-video overflow-hidden rounded bg-muted">
        <AssetThumbnail asset={asset} />
      </div>
      <div className="flex items-center gap-2 text-small text-charcoal/70">
        <Badge variant="outline">{asset.type}</Badge>
        <span>{asset.mimeType}</span>
      </div>
      <div>
        <Label htmlFor="asset-alt-text">Alt text</Label>
        <Input id="asset-alt-text" value={altText} onChange={(event) => setAltText(event.target.value)} placeholder="Describe this asset for accessibility" />
        {!altText && <p className="mt-1 text-small text-destructive">Required before this asset can be selected elsewhere.</p>}
      </div>
      <div>
        <Label htmlFor="asset-tags">Tags (comma-separated)</Label>
        <Input id="asset-tags" value={tagInput} onChange={(event) => setTagInput(event.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving…" : "Save"}
        </Button>
        {allowDelete && (
          <Button type="button" variant="destructive" onClick={handleDelete}>
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}
