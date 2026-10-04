import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** STORY-061. The only file querying SearchGlossaryTerm directly. */

type Client = Prisma.TransactionClient | typeof prisma;

export function listGlossaryTerms(client: Client = prisma) {
  return client.searchGlossaryTerm.findMany({ orderBy: { term: "asc" } });
}

export function findGlossaryTermById(id: string, client: Client = prisma) {
  return client.searchGlossaryTerm.findUnique({ where: { id } });
}

export interface GlossaryTermInput {
  term: string;
  canonicalTerm: string;
  targetType: string | null;
  targetId: string | null;
}

export function createGlossaryTerm(input: GlossaryTermInput, client: Client = prisma) {
  return client.searchGlossaryTerm.create({ data: input });
}

export function updateGlossaryTerm(id: string, input: Partial<GlossaryTermInput>, client: Client = prisma) {
  return client.searchGlossaryTerm.update({ where: { id }, data: input });
}

export function deleteGlossaryTerm(id: string, client: Client = prisma) {
  return client.searchGlossaryTerm.delete({ where: { id } });
}

/** Query expansion's own read — every term whose `term` appears as a substring of the (lowercased) query. Small table, scanned in full; no index needed at this scale. */
export async function findMatchingGlossaryTerms(query: string, client: Client = prisma) {
  const lower = query.toLowerCase();
  const all = await client.searchGlossaryTerm.findMany();
  return all.filter((row) => lower.includes(row.term.toLowerCase()));
}
