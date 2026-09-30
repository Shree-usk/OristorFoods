import { FileTextIcon, VideoIcon } from "lucide-react";

import type { MediaAsset } from "@/lib/api/admin-media-client";

/** Image types get a real thumbnail; Video/Document get a generic type icon — no server-side thumbnail generation exists yet (deferred alongside the compression/WebP pipeline). */
export function AssetThumbnail({ asset }: { asset: MediaAsset }) {
  if (asset.type === "Image") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={asset.url} alt="" className="size-full object-cover" />;
  }
  return (
    <div className="flex size-full items-center justify-center bg-muted text-muted-foreground">
      {asset.type === "Video" ? <VideoIcon className="size-8" /> : <FileTextIcon className="size-8" />}
    </div>
  );
}
