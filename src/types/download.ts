/**
 * Download library types shared by server and client code (STORY-023).
 * Keep this file free of server-only imports (Prisma, services): client
 * components import from it directly.
 */

export interface DownloadCategorySummary {
  id: string;
  name: string;
  slug: string;
}

/** A Published resource as returned by the listing API and rendered on a DownloadCard. */
export interface DownloadResourceCard {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnailUrl: string;
  fileType: string;
  fileSizeBytes: number;
  requiresAuth: boolean;
  category: DownloadCategorySummary;
}

export interface DownloadListResult {
  items: DownloadResourceCard[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DownloadListQuery {
  category?: string;
  page: number;
  pageSize: number;
}
