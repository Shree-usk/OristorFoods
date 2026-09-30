"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MediaAssetBrowser } from "@/components/admin/media/media-asset-browser";
import type { MediaAsset } from "@/lib/api/admin-media-client";

interface AssetPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (asset: MediaAsset) => void;
}

/**
 * STORY-041 AC: "A reusable AssetPickerDialog component is the only
 * sanctioned way other admin modules select an image/video/document" —
 * STORY-040's product form is the first consumer (see
 * admin-product-form.tsx's Media tab). Selecting an asset with no alt text
 * is rejected server-side (media.service.ts::selectAssetForPicker); the
 * shared MediaAssetBrowser opens that asset's detail panel inline so the
 * admin can add one without leaving the dialog.
 */
export function AssetPickerDialog({ open, onOpenChange, onSelect }: AssetPickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <h2 className="text-h3 font-heading text-charcoal">Select from Media Library</h2>
        <div className="mt-4">
          <MediaAssetBrowser
            mode="picker"
            onSelect={(asset) => {
              onSelect(asset);
              onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
