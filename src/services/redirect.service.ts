import { Prisma } from "@/generated/prisma/client";
import { parseSimpleCsv } from "@/lib/csv";
import { invalidateRedirectCache } from "@/lib/redirect-cache";
import * as redirectRepository from "@/repositories/redirect.repository";
import type { RedirectInput } from "@/repositories/redirect.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { requirePermission } from "@/services/permission.service";
import { RedirectConflictError, RedirectNotFoundError, RedirectSourcePathTakenError } from "@/services/redirect.errors";

/**
 * STORY-051b. Permission gating mirrors coupon-admin.service.ts's plain
 * View/Edit shape — a redirect has no distinct "make it live" step
 * beyond its own `active` flag, which Edit already covers.
 */

function isUniqueSourcePathViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  if (Array.isArray(target) && target.includes("sourcePath")) return true;
  if (typeof target === "string" && target.includes("sourcePath")) return true;
  const driverAdapterError = error.meta?.driverAdapterError as { cause?: { constraint?: { fields?: string[] } } } | undefined;
  const fields = driverAdapterError?.cause?.constraint?.fields;
  // The @prisma/adapter-pg driver echoes quoted-identifier column names
  // verbatim (e.g. `"sourcePath"`, quotes included) for any camelCase
  // column, which needs quoting in Postgres — strip them before comparing.
  return Array.isArray(fields) && fields.some((field) => field.replaceAll('"', "") === "sourcePath");
}

export interface RedirectCandidate {
  sourcePath: string;
  destinationPath: string;
}

/**
 * Banning any single 2-hop chain transitively bans every loop too — a
 * cycle of any length requires at least one such link to exist at some
 * point during its construction, so there's no graph traversal to do
 * here, just a flat check against the existing active redirect list.
 */
export function detectRedirectConflict(candidate: RedirectCandidate, existing: RedirectCandidate[]): RedirectConflictError | null {
  if (candidate.sourcePath === candidate.destinationPath) {
    return new RedirectConflictError("self_loop", `"${candidate.sourcePath}" cannot redirect to itself.`);
  }
  const pointsAtAnotherRedirectsSource = existing.some((r) => r.sourcePath === candidate.destinationPath);
  if (pointsAtAnotherRedirectsSource) {
    return new RedirectConflictError("chain", `"${candidate.destinationPath}" already redirects elsewhere — point directly at its final destination instead.`);
  }
  const alreadyRedirectedHere = existing.some((r) => r.destinationPath === candidate.sourcePath);
  if (alreadyRedirectedHere) {
    return new RedirectConflictError("chain", `Another redirect already points at "${candidate.sourcePath}" — redirecting it further would create a chain.`);
  }
  return null;
}

export async function listRedirectsForAdmin(adminUserId: string) {
  await requirePermission(adminUserId, "SEO", "View");
  return redirectRepository.listRedirectsForAdmin();
}

async function requireRedirectRow(id: string) {
  const redirect = await redirectRepository.findRedirectById(id);
  if (!redirect) throw new RedirectNotFoundError();
  return redirect;
}

export async function getRedirectAdminDetail(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "SEO", "View");
  return requireRedirectRow(id);
}

export async function createRedirect(adminUserId: string, input: RedirectInput) {
  await requirePermission(adminUserId, "SEO", "Edit");
  const existing = await redirectRepository.listActiveRedirects();
  const conflict = detectRedirectConflict(input, existing);
  if (conflict) throw conflict;

  try {
    const redirect = await redirectRepository.createRedirect(input, adminUserId);
    invalidateRedirectCache();
    await writeAuditLog({ actorId: adminUserId, action: "redirect_created", module: "SEO", targetType: "Redirect", targetId: redirect.id });
    return redirect;
  } catch (error) {
    if (isUniqueSourcePathViolation(error)) throw new RedirectSourcePathTakenError(input.sourcePath);
    throw error;
  }
}

export async function updateRedirect(adminUserId: string, id: string, input: Partial<RedirectInput>) {
  await requirePermission(adminUserId, "SEO", "Edit");
  const current = await requireRedirectRow(id);

  if (input.sourcePath !== undefined || input.destinationPath !== undefined) {
    const existing = (await redirectRepository.listActiveRedirects()).filter((r) => r.sourcePath !== current.sourcePath);
    const conflict = detectRedirectConflict({ sourcePath: input.sourcePath ?? current.sourcePath, destinationPath: input.destinationPath ?? current.destinationPath }, existing);
    if (conflict) throw conflict;
  }

  try {
    const redirect = await redirectRepository.updateRedirect(id, input);
    invalidateRedirectCache();
    await writeAuditLog({ actorId: adminUserId, action: "redirect_updated", module: "SEO", targetType: "Redirect", targetId: id });
    return redirect;
  } catch (error) {
    if (isUniqueSourcePathViolation(error)) throw new RedirectSourcePathTakenError(input.sourcePath ?? current.sourcePath);
    throw error;
  }
}

export async function deleteRedirect(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "SEO", "Edit");
  await requireRedirectRow(id);
  await redirectRepository.deleteRedirect(id);
  invalidateRedirectCache();
  await writeAuditLog({ actorId: adminUserId, action: "redirect_deleted", module: "SEO", targetType: "Redirect", targetId: id });
}

export interface BulkImportRowResult {
  line: number;
  sourcePath: string;
  error?: string;
}

export interface BulkImportResult {
  succeeded: BulkImportRowResult[];
  failed: BulkImportRowResult[];
}

function parseStatusCode(raw: string): number | null {
  const n = Number(raw);
  return n === 301 || n === 302 ? n : null;
}

/** Parses, validates (against the DB plus every row already accepted earlier in this same batch, so a batch can't create chains/loops/duplicates against itself either), and writes rows one at a time — a per-row result, not an all-or-nothing transaction. */
export async function bulkImportRedirects(adminUserId: string, csvText: string): Promise<BulkImportResult> {
  await requirePermission(adminUserId, "SEO", "Edit");

  const rows = parseSimpleCsv(csvText);
  const dbExisting = await redirectRepository.listActiveRedirects();
  const accepted: RedirectCandidate[] = [...dbExisting];

  const succeeded: BulkImportRowResult[] = [];
  const failed: BulkImportRowResult[] = [];

  for (const [index, row] of rows.entries()) {
    const line = index + 1;
    const [sourcePathRaw, destinationPathRaw, statusCodeRaw] = row;

    if (line === 1 && sourcePathRaw && !sourcePathRaw.startsWith("/")) continue; // header row

    const sourcePath = sourcePathRaw?.trim();
    const destinationPath = destinationPathRaw?.trim();
    const statusCode = statusCodeRaw ? parseStatusCode(statusCodeRaw) : 301;

    if (!sourcePath || !sourcePath.startsWith("/")) {
      failed.push({ line, sourcePath: sourcePathRaw ?? "", error: "Source path must start with \"/\"." });
      continue;
    }
    if (!destinationPath) {
      failed.push({ line, sourcePath, error: "Destination path is required." });
      continue;
    }
    if (statusCode === null) {
      failed.push({ line, sourcePath, error: "Status code must be 301 or 302." });
      continue;
    }
    if (accepted.some((r) => r.sourcePath === sourcePath)) {
      failed.push({ line, sourcePath, error: `"${sourcePath}" is already used by another row or an existing redirect.` });
      continue;
    }

    const conflict = detectRedirectConflict({ sourcePath, destinationPath }, accepted);
    if (conflict) {
      failed.push({ line, sourcePath, error: conflict.message });
      continue;
    }

    try {
      await redirectRepository.createRedirect({ sourcePath, destinationPath, statusCode, active: true }, adminUserId);
      accepted.push({ sourcePath, destinationPath });
      succeeded.push({ line, sourcePath });
    } catch (error) {
      failed.push({ line, sourcePath, error: isUniqueSourcePathViolation(error) ? `"${sourcePath}" already exists.` : "Failed to create this redirect." });
    }
  }

  if (succeeded.length > 0) invalidateRedirectCache();
  await writeAuditLog({ actorId: adminUserId, action: "redirects_bulk_imported", module: "SEO", metadata: { succeeded: succeeded.length, failed: failed.length } });
  return { succeeded, failed };
}
