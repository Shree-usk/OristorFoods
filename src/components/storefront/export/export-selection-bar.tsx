"use client";

import { useState } from "react";
import { X } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { downloadExportCataloguePdf } from "@/lib/api/export-catalogue-client";
import { useExportCatalogueSelectionStore } from "@/lib/stores/export-catalogue-selection-store";

export function ExportSelectionBar() {
  const items = useExportCatalogueSelectionStore((state) => state.items);
  const remove = useExportCatalogueSelectionStore((state) => state.remove);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (items.length === 0) return null;

  async function handleDownload() {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      await downloadExportCataloguePdf(items.map((item) => item.id));
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Failed to generate the catalogue PDF");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="sticky bottom-4 z-10 mt-6 rounded-lg border border-charcoal/10 bg-ivory/95 p-4 shadow-lg backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-small font-medium text-charcoal">
          {items.length} {items.length === 1 ? "product" : "products"} selected
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void handleDownload()} disabled={isDownloading}>
            {isDownloading ? "Generating…" : "Download catalogue (PDF)"}
          </Button>
          <Button size="sm" nativeButton={false} render={<Link href="#enquiry" />}>
            Start an enquiry
          </Button>
        </div>
      </div>

      {downloadError ? <p className="mt-2 text-small text-destructive">{downloadError}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span key={item.id} className="inline-flex items-center gap-1 rounded-full bg-charcoal/5 px-3 py-1 text-xs text-charcoal/80">
            {item.name}
            <button type="button" onClick={() => remove(item.id)} aria-label={`Remove ${item.name} from selection`} className="text-charcoal/50 hover:text-charcoal">
              <X className="size-3" aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
