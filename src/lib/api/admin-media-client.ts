/** STORY-041. Fetch wrappers for /api/admin/media/* — mirrors admin-product-client.ts's assertOk convention. */

function assertOk(response: Response, message: string): void {
  if (!response.ok) throw new Error(`${message} (${response.status})`);
}

export interface MediaTag {
  id: string;
  name: string;
}

export interface MediaFolderNode {
  id: string;
  name: string;
  parentId: string | null;
  children: MediaFolderNode[];
}

export interface MediaAsset {
  id: string;
  filename: string;
  originalName: string;
  url: string;
  mimeType: string;
  type: "Image" | "Video" | "Document";
  sizeBytes: number;
  width: number | null;
  height: number | null;
  altText: string | null;
  folderId: string | null;
  tags: MediaTag[];
  createdAt: string;
}

export interface MediaAssetListFilters {
  page?: number;
  pageSize?: number;
  folderId?: string;
  tagId?: string;
  type?: "Image" | "Video" | "Document";
  search?: string;
}

export interface MediaAssetListResult {
  items: MediaAsset[];
  total: number;
}

function toQueryString(filters: MediaAssetListFilters): string {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.folderId) params.set("folderId", filters.folderId);
  if (filters.tagId) params.set("tagId", filters.tagId);
  if (filters.type) params.set("type", filters.type);
  if (filters.search) params.set("search", filters.search);
  return params.toString();
}

export async function fetchMediaAssets(filters: MediaAssetListFilters): Promise<MediaAssetListResult> {
  const response = await fetch(`/api/admin/media?${toQueryString(filters)}`);
  assertOk(response, "Failed to load media assets");
  return response.json();
}

export async function fetchMediaAsset(id: string): Promise<MediaAsset> {
  const response = await fetch(`/api/admin/media/${id}`);
  assertOk(response, "Failed to load media asset");
  return response.json();
}

export interface UploadAssetsResult {
  succeeded: MediaAsset[];
  failed: { originalName: string; reason: string }[];
}

export async function uploadMediaAssets(files: File[], opts: { folderId?: string; tagNames?: string[] } = {}): Promise<UploadAssetsResult> {
  const formData = new FormData();
  for (const file of files) formData.append("files", file);
  if (opts.folderId) formData.append("folderId", opts.folderId);
  if (opts.tagNames?.length) formData.append("tagNames", JSON.stringify(opts.tagNames));

  const response = await fetch("/api/admin/media/upload", { method: "POST", body: formData });
  assertOk(response, "Failed to upload files");
  return response.json();
}

export async function updateMediaAsset(id: string, input: { altText?: string | null; folderId?: string | null; tagNames?: string[] }): Promise<MediaAsset> {
  const response = await fetch(`/api/admin/media/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  assertOk(response, "Failed to update media asset");
  return response.json();
}

export async function deleteMediaAsset(id: string): Promise<void> {
  const response = await fetch(`/api/admin/media/${id}`, { method: "DELETE" });
  assertOk(response, "Failed to delete media asset");
}

/** Enforces the alt-text-required gate server-side before returning the asset to the picker's onSelect. */
export async function selectMediaAsset(id: string): Promise<MediaAsset> {
  const response = await fetch(`/api/admin/media/${id}/select`, { method: "POST" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Failed to select asset" }));
    throw new Error(body.error ?? "Failed to select asset");
  }
  return response.json();
}

export async function fetchMediaTags(): Promise<MediaTag[]> {
  const response = await fetch("/api/admin/media/tags");
  assertOk(response, "Failed to load tags");
  const body: { tags: MediaTag[] } = await response.json();
  return body.tags;
}

export async function fetchMediaFolderTree(): Promise<MediaFolderNode[]> {
  const response = await fetch("/api/admin/media/folders");
  assertOk(response, "Failed to load folders");
  const body: { tree: MediaFolderNode[] } = await response.json();
  return body.tree;
}

export async function createMediaFolder(name: string, parentId: string | null): Promise<MediaFolderNode> {
  const response = await fetch("/api/admin/media/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, parentId }),
  });
  assertOk(response, "Failed to create folder");
  return response.json();
}

export async function renameMediaFolder(id: string, name: string): Promise<void> {
  const response = await fetch(`/api/admin/media/folders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  assertOk(response, "Failed to rename folder");
}

export async function deleteMediaFolder(id: string): Promise<void> {
  const response = await fetch(`/api/admin/media/folders/${id}`, { method: "DELETE" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Failed to delete folder" }));
    throw new Error(body.error ?? "Failed to delete folder");
  }
}
