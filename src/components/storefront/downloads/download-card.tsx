import Image from "next/image";

import { formatFileSize } from "@/lib/format-file-size";
import type { DownloadResourceCard } from "@/types/download";

export function DownloadCard({ resource }: { resource: DownloadResourceCard }) {
  const sizeLabel = `${resource.fileType} · ${formatFileSize(resource.fileSizeBytes)}`;
  const accessibleLabel = `Download ${resource.title}, ${sizeLabel}`;

  return (
    <article className="overflow-hidden rounded-lg border border-input bg-cream">
      <div className="relative aspect-[4/3]">
        <Image src={resource.thumbnailUrl} alt="" fill className="object-cover" />
      </div>
      <div className="p-4">
        <p className="text-caption text-charcoal/60">{resource.category.name}</p>
        <h3 className="mt-1 text-h4 font-heading text-charcoal">{resource.title}</h3>
        {resource.description ? <p className="mt-1 text-small text-charcoal/70">{resource.description}</p> : null}
        <p className="mt-2 text-caption text-charcoal/60">{sizeLabel}</p>
        <a
          href={`/api/downloads/${resource.slug}/file`}
          download
          aria-label={accessibleLabel}
          className="mt-3 inline-flex items-center rounded-full bg-chilli px-4 py-2 text-small font-medium text-white"
        >
          Download
        </a>
      </div>
    </article>
  );
}
