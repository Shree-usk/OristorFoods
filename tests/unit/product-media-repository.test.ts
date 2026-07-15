// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  addProductImage,
  addProductVideo,
  createProduct,
  listProductImages,
  listProductVideos,
} from "@/repositories/product.repository";

afterEach(async () => {
  await prisma.product.deleteMany();
});

describe("product media", () => {
  it("adds and orders images and videos for a product", async () => {
    const product = await createProduct({
      sku: "ORI-CP-100",
      slug: "curry-powder-100g",
      name: "Roasted Curry Powder 100g",
    });

    await addProductImage({
      product: { connect: { id: product.id } },
      url: "/images/curry-powder-2.jpg",
      isPrimary: false,
      sortOrder: 2,
    });
    await addProductImage({
      product: { connect: { id: product.id } },
      url: "/images/curry-powder-1.jpg",
      isPrimary: true,
      sortOrder: 1,
    });
    await addProductVideo({
      product: { connect: { id: product.id } },
      url: "/videos/curry-powder-demo.mp4",
      mediaRole: "Video",
    });

    const images = await listProductImages(product.id);
    const videos = await listProductVideos(product.id);

    expect(images.map((i) => i.url)).toEqual([
      "/images/curry-powder-1.jpg",
      "/images/curry-powder-2.jpg",
    ]);
    expect(images[0].isPrimary).toBe(true);
    expect(videos).toHaveLength(1);
  });
});
