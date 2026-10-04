import { Prisma } from "@/generated/prisma/client";
import * as glossaryRepository from "@/repositories/glossary-term.repository";
import type { GlossaryTermInput } from "@/repositories/glossary-term.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { GlossaryTermDuplicateError, GlossaryTermNotFoundError } from "@/services/glossary.errors";
import { requirePermission } from "@/services/permission.service";

/**
 * STORY-061. Sinhala/Tamil transliteration + synonym glossary —
 * admin-managed (Admin Console Principle), gated CRMAnalytics... no,
 * Products (the module STORY-060's own admin-triggered recompute
 * reused, the closest existing module to "search/catalogue tuning
 * data"). Ships with zero seeded entries — see
 * docs/architecture-decisions.md for why.
 */

export async function listGlossaryTerms(adminUserId: string) {
  await requirePermission(adminUserId, "Products", "View");
  return glossaryRepository.listGlossaryTerms();
}

async function requireGlossaryTermRow(id: string) {
  const term = await glossaryRepository.findGlossaryTermById(id);
  if (!term) throw new GlossaryTermNotFoundError();
  return term;
}

export async function createGlossaryTerm(adminUserId: string, input: GlossaryTermInput) {
  await requirePermission(adminUserId, "Products", "Edit");
  try {
    const term = await glossaryRepository.createGlossaryTerm(input);
    await writeAuditLog({ actorId: adminUserId, action: "glossary_term_created", module: "Products", targetType: "SearchGlossaryTerm", targetId: term.id, metadata: { term: term.term } });
    return term;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new GlossaryTermDuplicateError();
    throw error;
  }
}

export async function updateGlossaryTerm(adminUserId: string, id: string, input: Partial<GlossaryTermInput>) {
  await requirePermission(adminUserId, "Products", "Edit");
  await requireGlossaryTermRow(id);
  try {
    const term = await glossaryRepository.updateGlossaryTerm(id, input);
    await writeAuditLog({ actorId: adminUserId, action: "glossary_term_updated", module: "Products", targetType: "SearchGlossaryTerm", targetId: id });
    return term;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new GlossaryTermDuplicateError();
    throw error;
  }
}

export async function deleteGlossaryTerm(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "Products", "Delete");
  await requireGlossaryTermRow(id);
  await glossaryRepository.deleteGlossaryTerm(id);
  await writeAuditLog({ actorId: adminUserId, action: "glossary_term_deleted", module: "Products", targetType: "SearchGlossaryTerm", targetId: id });
}

/**
 * Search-time query expansion — no permission gate (called from the
 * public search path, same as resolveSegmentMembers/previewSegment's
 * own no-gate convention for a read used mid-flow by another
 * already-gated or public feature). Appends each matching term's
 * canonical form once; the embedding/keyword layers see the richer
 * text, the original query is never discarded.
 */
export async function expandQuery(query: string): Promise<string> {
  const matches = await glossaryRepository.findMatchingGlossaryTerms(query);
  if (matches.length === 0) return query;
  const additions = matches.map((match) => match.canonicalTerm).filter((canonical) => !query.toLowerCase().includes(canonical.toLowerCase()));
  return additions.length > 0 ? `${query} ${additions.join(" ")}` : query;
}
