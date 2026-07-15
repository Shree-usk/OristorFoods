// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  createCollection,
  findCollectionBySlug,
  listActiveCollections,
} from "@/repositories/collection.repository";

afterEach(async () => {
  await prisma.collection.deleteMany();
});

describe("collection.repository", () => {
  it("creates a collection and finds it by slug", async () => {
    await createCollection({ name: "New Year Specials", slug: "new-year-specials" });

    const found = await findCollectionBySlug("new-year-specials");

    expect(found?.name).toBe("New Year Specials");
  });

  it("lists always-on active collections", async () => {
    await createCollection({ name: "Bestsellers", slug: "bestsellers" });

    const active = await listActiveCollections(new Date("2026-07-15"));

    expect(active.map((c) => c.slug)).toEqual(["bestsellers"]);
  });

  it("excludes a seasonal collection outside its date window", async () => {
    await createCollection({
      name: "Avurudu 2026",
      slug: "avurudu-2026",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2026-04-30"),
    });

    const duringWindow = await listActiveCollections(new Date("2026-04-15"));
    const afterWindow = await listActiveCollections(new Date("2026-07-15"));

    expect(duringWindow.map((c) => c.slug)).toEqual(["avurudu-2026"]);
    expect(afterWindow.map((c) => c.slug)).toEqual([]);
  });

  it("lists a collection with only a startDate as active from that date onward", async () => {
    await createCollection({
      name: "Loyalty Launch",
      slug: "loyalty-launch",
      startDate: new Date("2026-01-01"),
    });

    const onOrAfterStart = await listActiveCollections(new Date("2026-07-15"));
    const beforeStart = await listActiveCollections(new Date("2025-12-01"));

    expect(onOrAfterStart.map((c) => c.slug)).toEqual(["loyalty-launch"]);
    expect(beforeStart.map((c) => c.slug)).toEqual([]);
  });

  it("lists a collection with only an endDate as active up to that date", async () => {
    await createCollection({
      name: "Winter Clearance",
      slug: "winter-clearance",
      endDate: new Date("2026-12-31"),
    });

    const onOrBeforeEnd = await listActiveCollections(new Date("2026-07-15"));
    const afterEnd = await listActiveCollections(new Date("2027-01-01"));

    expect(onOrBeforeEnd.map((c) => c.slug)).toEqual(["winter-clearance"]);
    expect(afterEnd.map((c) => c.slug)).toEqual([]);
  });
});
