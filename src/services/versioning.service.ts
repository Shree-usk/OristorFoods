import type { AdminModule } from "@/generated/prisma/client";
import * as contentVersionRepository from "@/repositories/content-version.repository";
import { requirePermission } from "@/services/permission.service";
import { VersionNotFoundError } from "@/services/versioning.errors";

/**
 * STORY-053 (additive scope). Generic, entity-agnostic — has no
 * knowledge of Homepage/Recipe/Blog's own fields, statuses, or
 * transition rules. `recordVersion` is called as a trailing side
 * effect from inside each content type's own already-permission-gated
 * publish function (same convention as audit-log.service.ts's
 * writeAuditLog — an internal recorder, not an independently exposed
 * admin action, so it doesn't re-check permission itself).
 */

/** Maps a version's entityType to the admin module that gates viewing it — each content type keeps its own existing permission model; this just knows which one to ask. */
const MODULE_BY_ENTITY_TYPE: Record<string, AdminModule> = {
  HomepageLayout: "HomepageBuilder",
  Recipe: "Recipes",
  BlogPost: "Blog",
};

function requireKnownEntityType(entityType: string): AdminModule {
  const adminModule = MODULE_BY_ENTITY_TYPE[entityType];
  if (!adminModule) throw new Error(`Unknown versioned entity type: ${entityType}`);
  return adminModule;
}

export async function recordVersion(entityType: string, entityId: string, snapshot: unknown, actorId: string | null) {
  const versionNumber = await contentVersionRepository.nextVersionNumber(entityType, entityId);
  return contentVersionRepository.createVersion({ entityType, entityId, versionNumber, snapshot, createdById: actorId });
}

export async function listVersions(adminUserId: string, entityType: string, entityId: string) {
  await requirePermission(adminUserId, requireKnownEntityType(entityType), "View");
  return contentVersionRepository.listVersions(entityType, entityId);
}

export async function getVersion(adminUserId: string, entityType: string, versionId: string) {
  await requirePermission(adminUserId, requireKnownEntityType(entityType), "View");
  const version = await contentVersionRepository.findVersionById(versionId);
  if (!version || version.entityType !== entityType) throw new VersionNotFoundError();
  return version;
}

export interface VersionDiffEntry {
  path: string;
  before: unknown;
  after: unknown;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Arrays are compared atomically (by value, not element-by-element) — this story's AC asks for "a diff between any two versions," not a structural array-merge algorithm, and these snapshots' arrays (ingredients, steps, sections) are small enough that an atomic "this list changed" is clear enough. */
function diffValues(path: string, before: unknown, after: unknown, out: VersionDiffEntry[]): void {
  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      diffValues(path ? `${path}.${key}` : key, before[key], after[key], out);
    }
    return;
  }
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    out.push({ path, before, after });
  }
}

export async function diffVersions(adminUserId: string, entityType: string, versionIdA: string, versionIdB: string): Promise<VersionDiffEntry[]> {
  await requirePermission(adminUserId, requireKnownEntityType(entityType), "View");
  const [a, b] = await Promise.all([contentVersionRepository.findVersionById(versionIdA), contentVersionRepository.findVersionById(versionIdB)]);
  if (!a || a.entityType !== entityType) throw new VersionNotFoundError();
  if (!b || b.entityType !== entityType) throw new VersionNotFoundError();

  const out: VersionDiffEntry[] = [];
  diffValues("", a.snapshot, b.snapshot, out);
  return out;
}
