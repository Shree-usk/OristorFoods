// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createStandardPrice } from "@/repositories/pricing.repository";
import { upsertProductEmbedding } from "@/repositories/embedding.repository";
import type { EmbeddingProvider } from "@/services/embedding/embedding-provider.interface";
import { createGlossaryTerm } from "@/services/glossary.service";
import { getSmartSearchResults, setSmartSearchEmbeddingProviderForTesting } from "@/services/smart-search.service";

const EMAIL_DOMAIN = "@smart-search-svc-test.test";
const ROLE_KEY_PREFIX = "smart-search-svc-test-role-";
const SKU_PREFIX = "SMARTSEARCH-SVC-SKU-";
const TERM_PREFIX = "smart-search-svc-term-";
let sequence = 0;

function unitVector(dim: number): number[] {
  const vector = Array.from({ length: 1536 }, () => 0);
  vector[dim % 1536] = 1;
  return vector;
}

function makeFailingProvider(): EmbeddingProvider {
  return { name: "failing", generateEmbedding: async () => { throw new Error("no credits"); } };
}

function makeFixedProvider(embedding: number[]): EmbeddingProvider {
  return { name: "fixed", generateEmbedding: async () => ({ embedding, tokensUsed: 5 }) };
}

async function makeProduct(name: string) {
  sequence += 1;
  const product = await createProduct({ sku: `${SKU_PREFIX}${sequence}`, slug: `smart-search-svc-product-${sequence}`, name, status: "Published", stockQuantity: 10 });
  await createStandardPrice({ product: { connect: { id: product.id } }, price: "100.00" });
  return product;
}

async function makeAdmin() {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Smart Search Svc Test Role ${sequence}` } });
  await prisma.rolePermission.create({ data: { roleId: role.id, module: "Products", action: "Edit" } });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

afterEach(async () => {
  setSmartSearchEmbeddingProviderForTesting(makeFailingProvider());
  await prisma.searchQueryLog.deleteMany();
  await prisma.productEmbedding.deleteMany();
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.searchGlossaryTerm.deleteMany({ where: { term: { startsWith: TERM_PREFIX } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("smart-search.service — transparent keyword fallback (AC #7)", () => {
  it("still returns the keyword match when the embedding call fails, with semanticLayerUsed false", async () => {
    setSmartSearchEmbeddingProviderForTesting(makeFailingProvider());
    const product = await makeProduct(`Smart Search Svc Fallback Spice ${sequence}`);

    const result = await getSmartSearchResults(product.name);

    expect(result.products.map((p) => p.id)).toContain(product.id);
    expect(result.semanticLayerUsed).toBe(false);
    expect(result.embeddingTokensUsed).toBeNull();
  });

  it("logs a zero-result query", async () => {
    setSmartSearchEmbeddingProviderForTesting(makeFailingProvider());
    const query = "a query matching absolutely nothing in this catalogue";

    const result = await getSmartSearchResults(query);

    expect(result.products).toHaveLength(0);
    const logRow = await prisma.searchQueryLog.findFirst({ where: { query }, orderBy: { createdAt: "desc" } });
    expect(logRow?.isZeroResult).toBe(true);
    expect(logRow?.embeddingTokens).toBeNull();
  });
});

describe("smart-search.service — semantic blending", () => {
  it("surfaces a product matched only by vector similarity, not by keyword", async () => {
    sequence += 1;
    const queryVector = unitVector(sequence);
    const semanticOnlyProduct = await makeProduct(`Smart Search Svc Unrelated Name ${sequence}`);
    await upsertProductEmbedding(semanticOnlyProduct.id, queryVector, "text-embedding-3-small");
    setSmartSearchEmbeddingProviderForTesting(makeFixedProvider(queryVector));

    const result = await getSmartSearchResults("a query with no keyword overlap at all");

    expect(result.semanticLayerUsed).toBe(true);
    expect(result.products.map((p) => p.id)).toContain(semanticOnlyProduct.id);
  });
});

describe("smart-search.service — glossary query expansion", () => {
  it("matches a product via a glossary-expanded synonym", async () => {
    sequence += 1;
    setSmartSearchEmbeddingProviderForTesting(makeFailingProvider());
    const admin = await makeAdmin();
    const term = `${TERM_PREFIX}${sequence}`;
    const canonical = `smart search svc canonical ${sequence}`;
    await createGlossaryTerm(admin.id, { term, canonicalTerm: canonical, targetType: null, targetId: null });
    const product = await makeProduct(canonical);

    const result = await getSmartSearchResults(term);

    expect(result.products.map((p) => p.id)).toContain(product.id);
  });
});
