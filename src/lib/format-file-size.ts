/**
 * Formats a byte count as a short human string for the download listing
 * ("1.2 MB"), matching the AC's "PDF · 1.2 MB" display requirement. Only
 * B/KB/MB are needed — nothing this library serves is ever gigabyte-scale.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
