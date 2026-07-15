// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createCollection } from "@/repositories/collection.repository";
import { getPublishedCollectionBySlug } from "@/services/collection.service";

afterEach(async () => {
  await prisma.collection.deleteMany();
});

describe("collection.service", () => {
  it("returns an active collection within its date window", async () => {
    await createCollection({
      name: "Avurudu 2026",
      slug: "avurudu-2026",
      status: "Active",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-04-30"),
    });

    const found = await getPublishedCollectionBySlug("avurudu-2026", new Date("2026-04-15"));

    expect(found?.slug).toBe("avurudu-2026");
  });

  it("returns null for an inactive collection", async () => {
    await createCollection({ name: "Retired", slug: "retired", status: "Inactive" });

    expect(await getPublishedCollectionBySlug("retired")).toBeNull();
  });

  it("returns a collection with only a past startDate (no upper bound)", async () => {
    await createCollection({
      name: "Loyalty Launch",
      slug: "loyalty-launch",
      status: "Active",
      startDate: new Date("2026-01-01"),
    });

    const found = await getPublishedCollectionBySlug("loyalty-launch", new Date("2026-07-15"));

    expect(found?.slug).toBe("loyalty-launch");
  });

  it("returns null for a collection with only a future startDate", async () => {
    await createCollection({
      name: "Spring Preview",
      slug: "spring-preview",
      status: "Active",
      startDate: new Date("2027-03-01"),
    });

    expect(await getPublishedCollectionBySlug("spring-preview", new Date("2026-07-15"))).toBeNull();
  });

  it("returns a collection with only a future endDate (no lower bound)", async () => {
    await createCollection({
      name: "Winter Clearance",
      slug: "winter-clearance",
      status: "Active",
      endDate: new Date("2026-12-31"),
    });

    const found = await getPublishedCollectionBySlug("winter-clearance", new Date("2026-07-15"));

    expect(found?.slug).toBe("winter-clearance");
  });

  it("returns null for a collection with only a past endDate", async () => {
    await createCollection({
      name: "Old Promo",
      slug: "old-promo",
      status: "Active",
      endDate: new Date("2026-01-01"),
    });

    expect(await getPublishedCollectionBySlug("old-promo", new Date("2026-07-15"))).toBeNull();
  });
});
