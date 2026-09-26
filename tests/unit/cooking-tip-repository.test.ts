// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import {
  findActiveTopicTagsWithPublishedTips,
  findPublishedCookingTipBySlug,
  findPublishedCookingTips,
  findRelatedCookingTips,
} from "@/repositories/cooking-tip.repository";
import { cleanupRecipes, makeCookingTip } from "./recipe-fixtures";

afterEach(async () => {
  await cleanupRecipes();
  await prisma.product.deleteMany();
});

describe("findPublishedCookingTips", () => {
  it("only returns Published tips, filtered by topic when given", async () => {
    await makeCookingTip({ title: "Published Knife", topicTag: "knife-skills" });
    await makeCookingTip({ title: "Draft Knife", topicTag: "knife-skills", status: "Draft" });
    await makeCookingTip({ title: "Published Storage", topicTag: "storage" });

    const all = await findPublishedCookingTips({ where: {}, skip: 0, take: 10 });
    expect(all.rows.map((r) => r.title).sort()).toEqual(["Published Knife", "Published Storage"]);

    const knifeOnly = await findPublishedCookingTips({ where: { topicTag: "knife-skills" }, skip: 0, take: 10 });
    expect(knifeOnly.rows.map((r) => r.title)).toEqual(["Published Knife"]);
  });

  it("cannot be overridden by a caller-supplied status filter", async () => {
    await makeCookingTip({ title: "Real Published" });
    await makeCookingTip({ title: "Sneaky Draft", status: "Draft" });

    // Even if a caller's where object tries to widen the status filter, only Published tips come back.
    const result = await findPublishedCookingTips({
      where: { status: "Draft" } as Prisma.CookingTipWhereInput,
      skip: 0,
      take: 10,
    });
    expect(result.rows.map((r) => r.title)).toEqual(["Real Published"]);
  });
});

describe("findPublishedCookingTipBySlug", () => {
  it("returns null for a missing or Draft slug", async () => {
    await makeCookingTip({ slug: "draft-tip", status: "Draft" });
    expect(await findPublishedCookingTipBySlug("draft-tip")).toBeNull();
    expect(await findPublishedCookingTipBySlug("does-not-exist")).toBeNull();
  });

  it("includes linked products", async () => {
    const product = await createProduct({ sku: "SKU-CT-1", slug: "curry-powder-ct", name: "Curry Powder", status: "Published" });
    await makeCookingTip({ slug: "with-product", productIds: [product.id] });

    const result = await findPublishedCookingTipBySlug("with-product");
    expect(result?.productRefs.map((ref) => ref.product.slug)).toEqual(["curry-powder-ct"]);
  });

  it("only includes Published linked products, excluding Draft/Archived/etc", async () => {
    const published = await createProduct({ sku: "SKU-CT-PUB", slug: "curry-powder-pub", name: "Curry Powder", status: "Published" });
    const draft = await createProduct({ sku: "SKU-CT-DRAFT", slug: "curry-powder-draft", name: "Draft Curry Powder", status: "Draft" });
    await makeCookingTip({ slug: "with-mixed-products", productIds: [published.id, draft.id] });

    const result = await findPublishedCookingTipBySlug("with-mixed-products");
    expect(result?.productRefs.map((ref) => ref.product.slug)).toEqual(["curry-powder-pub"]);
  });
});

describe("findRelatedCookingTips", () => {
  it("excludes the tip itself and only returns Published tips sharing the topic", async () => {
    const target = await makeCookingTip({ slug: "target", topicTag: "knife-skills" });
    await makeCookingTip({ slug: "same-topic", topicTag: "knife-skills" });
    await makeCookingTip({ slug: "draft-same-topic", topicTag: "knife-skills", status: "Draft" });
    await makeCookingTip({ slug: "other-topic", topicTag: "storage" });

    const related = await findRelatedCookingTips({ id: target.id, topicTag: target.topicTag }, 6);
    expect(related.map((r) => r.slug)).toEqual(["same-topic"]);
  });
});

describe("findActiveTopicTagsWithPublishedTips", () => {
  it("returns distinct topic tags that have at least one Published tip", async () => {
    await makeCookingTip({ topicTag: "knife-skills" });
    await makeCookingTip({ topicTag: "knife-skills" });
    await makeCookingTip({ topicTag: "storage-only-drafts", status: "Draft" });

    const tags = await findActiveTopicTagsWithPublishedTips();
    expect(tags.map((t) => t.tag)).toEqual(["knife-skills"]);
  });
});
