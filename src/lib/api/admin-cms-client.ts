/** STORY-053 (additive scope). Fetch wrappers for /api/admin/cms/*. */

function assertOk(response: Response, message: string): void {
  if (!response.ok) throw new Error(`${message} (${response.status})`);
}

export type VersionedEntityType = "HomepageLayout" | "Recipe" | "BlogPost";

export interface ContentVersion {
  id: string;
  entityType: string;
  entityId: string;
  versionNumber: number;
  snapshot: unknown;
  createdById: string | null;
  createdAt: string;
}

export interface VersionDiffEntry {
  path: string;
  before: unknown;
  after: unknown;
}

export interface ReviewQueueItem {
  sourceType: string;
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  href: string;
}

export async function fetchVersions(entityType: VersionedEntityType, entityId: string): Promise<ContentVersion[]> {
  const response = await fetch(`/api/admin/cms/versions/${entityType}/${entityId}`);
  assertOk(response, "Failed to load version history");
  return response.json();
}

export async function fetchVersionDiff(entityType: VersionedEntityType, entityId: string, versionIdA: string, versionIdB: string): Promise<VersionDiffEntry[]> {
  const response = await fetch(`/api/admin/cms/versions/${entityType}/${entityId}/diff?a=${versionIdA}&b=${versionIdB}`);
  assertOk(response, "Failed to load the version diff");
  const data = await response.json();
  return data.diff;
}

export async function rollbackToVersion(entityType: VersionedEntityType, entityId: string, versionId: string): Promise<unknown> {
  const response = await fetch(`/api/admin/cms/versions/${entityType}/${entityId}/${versionId}/rollback`, { method: "POST" });
  assertOk(response, "Failed to restore this version");
  return response.json();
}

export async function fetchMyReviewQueue(): Promise<ReviewQueueItem[]> {
  const response = await fetch("/api/admin/cms/my-queue");
  assertOk(response, "Failed to load your review queue");
  return response.json();
}
