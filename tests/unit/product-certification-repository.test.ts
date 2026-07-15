// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  attachCertification,
  createCertification,
  createProduct,
  listProductCertifications,
} from "@/repositories/product.repository";

afterEach(async () => {
  await prisma.product.deleteMany();
  await prisma.certification.deleteMany();
});

describe("product certifications", () => {
  it("attaches a certification to a product and lists it back", async () => {
    const product = await createProduct({
      sku: "ORI-CP-100",
      slug: "curry-powder-100g",
      name: "Roasted Curry Powder 100g",
    });
    const haccp = await createCertification({ name: "HACCP" });

    await attachCertification(product.id, haccp.id);
    const certifications = await listProductCertifications(product.id);

    expect(certifications.map((c) => c.name)).toEqual(["HACCP"]);
  });
});
