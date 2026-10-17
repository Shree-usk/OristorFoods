// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { resetRateLimit } from "@/lib/rate-limit";

const { POST } = await import("@/app/api/export/catalogue/pdf/route");

const SKU_PREFIX = "EXPORT-PDF-ROUTE-TEST-";
let sequence = 0;

async function makeProduct() {
  sequence += 1;
  return prisma.product.create({
    data: { sku: `${SKU_PREFIX}${sequence}`, slug: `export-pdf-route-test-${sequence}`, name: `PDF Route Test Product ${sequence}`, status: "Published", isExportEnabled: true },
  });
}

function postPdf(body: unknown) {
  return POST(new Request("http://localhost/api/export/catalogue/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
}

afterEach(async () => {
  resetRateLimit("export-catalogue-pdf:anonymous");
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
});

describe("POST /api/export/catalogue/pdf", () => {
  it("returns a valid PDF for a real export-enabled product id", async () => {
    const product = await makeProduct();
    const response = await postPdf({ productIds: [product.id] });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    const buffer = Buffer.from(await response.arrayBuffer());
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("rejects an empty productIds array with 400", async () => {
    const response = await postPdf({ productIds: [] });
    expect(response.status).toBe(400);
  });

  it("rejects more than 50 productIds with 400", async () => {
    const response = await postPdf({ productIds: Array.from({ length: 51 }, (_, i) => `id-${i}`) });
    expect(response.status).toBe(400);
  });

  it("rejects malformed JSON with 400 rather than a 500", async () => {
    const response = await POST(new Request("http://localhost/api/export/catalogue/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: "not json" }));
    expect(response.status).toBe(400);
  });

  it("enforces the rate limit after repeated requests from the same (anonymous) caller", async () => {
    const product = await makeProduct();
    let lastResponse: Response | undefined;
    for (let i = 0; i < 15; i++) {
      lastResponse = await postPdf({ productIds: [product.id] });
    }
    expect(lastResponse?.status).toBe(429);
  });
});
