import { randomUUID } from "node:crypto";
import type { ContentSourceType } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/**
 * STORY-061. The only file touching ProductEmbedding/ContentEmbedding
 * directly — Unsupported("vector(N)") isn't readable/writable through
 * the generated Prisma client, so every read/write here is raw SQL,
 * the same established precedent as search.repository.ts/
 * analytics.repository.ts/recommendation.repository.ts.
 */

const EMBEDDING_DIMENSIONS = 1536;

function toVectorLiteral(embedding: number[]): string {
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(`Expected a ${EMBEDDING_DIMENSIONS}-dimension embedding, got ${embedding.length}`);
  }
  return `[${embedding.join(",")}]`;
}

/** Idempotent — safe to call on every recompute/seed run, not a one-time migration step (this session's `db push` workflow has no migration files). */
export async function ensureVectorIndexes(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ProductEmbedding_embedding_hnsw_idx" ON "ProductEmbedding" USING hnsw (embedding vector_cosine_ops)`,
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ContentEmbedding_embedding_hnsw_idx" ON "ContentEmbedding" USING hnsw (embedding vector_cosine_ops)`,
  );
}

export async function upsertProductEmbedding(productId: string, embedding: number[], modelVersion: string): Promise<void> {
  const literal = toVectorLiteral(embedding);
  await prisma.$executeRaw`
    INSERT INTO "ProductEmbedding" (id, "productId", embedding, "modelVersion", "updatedAt")
    VALUES (${randomUUID()}, ${productId}, ${literal}::vector, ${modelVersion}, now())
    ON CONFLICT ("productId") DO UPDATE SET embedding = ${literal}::vector, "modelVersion" = ${modelVersion}, "updatedAt" = now()
  `;
}

export async function upsertContentEmbedding(sourceType: ContentSourceType, sourceId: string, embedding: number[], modelVersion: string): Promise<void> {
  const literal = toVectorLiteral(embedding);
  await prisma.$executeRaw`
    INSERT INTO "ContentEmbedding" (id, "sourceType", "sourceId", embedding, "modelVersion", "updatedAt")
    VALUES (${randomUUID()}, ${sourceType}::"ContentSourceType", ${sourceId}, ${literal}::vector, ${modelVersion}, now())
    ON CONFLICT ("sourceType", "sourceId") DO UPDATE SET embedding = ${literal}::vector, "modelVersion" = ${modelVersion}, "updatedAt" = now()
  `;
}

export interface SimilarMatch {
  id: string;
  similarity: number;
}

/** Published-only via the join — a product whose embedding row survived a status change back to Draft is never returned. */
export async function findSimilarProductIds(embedding: number[], limit: number): Promise<SimilarMatch[]> {
  const literal = toVectorLiteral(embedding);
  const rows = await prisma.$queryRaw<{ id: string; similarity: number }[]>`
    SELECT pe."productId" AS id, 1 - (pe.embedding <=> ${literal}::vector) AS similarity
    FROM "ProductEmbedding" pe
    JOIN "Product" p ON p.id = pe."productId"
    WHERE p.status = 'Published'::"ProductStatus"
    ORDER BY pe.embedding <=> ${literal}::vector
    LIMIT ${limit}
  `;
  return rows;
}

/**
 * Published-status filtering is NOT done here — ContentEmbedding is
 * polymorphic (Recipe/BlogPost/FoodAcademyEntry), so a single join
 * can't express it. The caller resolves candidate ids back to display
 * data via each content type's own existing findPublished* repository
 * function (which already enforces Published internally), the same
 * "resolve an id list through the real published-only read path"
 * shape recommendation.repository.ts's resolveProductCards uses.
 */
export async function findSimilarContentIds(embedding: number[], sourceType: ContentSourceType, limit: number): Promise<SimilarMatch[]> {
  const literal = toVectorLiteral(embedding);
  const rows = await prisma.$queryRaw<{ id: string; similarity: number }[]>`
    SELECT "sourceId" AS id, 1 - (embedding <=> ${literal}::vector) AS similarity
    FROM "ContentEmbedding"
    WHERE "sourceType" = ${sourceType}::"ContentSourceType"
    ORDER BY embedding <=> ${literal}::vector
    LIMIT ${limit}
  `;
  return rows;
}

export interface CreateSearchQueryLogInput {
  query: string;
  resultCount: number;
  isZeroResult: boolean;
  embeddingTokens: number | null;
  customerId: string | null;
  sessionId: string | null;
}

export function createSearchQueryLog(input: CreateSearchQueryLogInput) {
  return prisma.searchQueryLog.create({ data: input });
}
