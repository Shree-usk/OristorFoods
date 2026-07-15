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
});
