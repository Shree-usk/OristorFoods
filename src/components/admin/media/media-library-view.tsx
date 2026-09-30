"use client";

import { MediaAssetBrowser } from "@/components/admin/media/media-asset-browser";

export function MediaLibraryView() {
  return (
    <div>
      <h1 className="text-h2 font-heading text-charcoal">Media Library</h1>
      <div className="mt-6">
        <MediaAssetBrowser mode="manage" />
      </div>
    </div>
  );
}
