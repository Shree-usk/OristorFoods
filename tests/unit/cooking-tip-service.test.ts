// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { getCookingTipBySlug, listCookingTips, listCookingTipTopics } from "@/services/cooking-tip.service";
import { cleanupRecipes, makeCookingTip } from "./recipe-fixtures";

afterEach(async () => {
  await cleanupRecipes();
});

describe("listCookingTips", () => {
  it("maps rows to CookingTipCard and echoes page/pageSize", async () => {
    await makeCookingTip({ title: "Tip One", topicTag: "knife-skills" });
    const result = await listCookingTips({ page: 1, pageSize: 10 });
    expect(result).toMatchObject({ page: 1, pageSize: 10, total: 1 });
    expect(result.tips[0]).toMatchObject({ title: "Tip One", href: "/recipes/cooking-tips/tip-one".replace("tip-one", result.tips[0]!.slug) });
  });

  it("filters by topic", async () => {
    await makeCookingTip({ title: "Knife", topicTag: "knife-skills" });
    await makeCookingTip({ title: "Storage", topicTag: "storage" });
    const result = await listCookingTips({ page: 1, pageSize: 10, topic: "storage" });
    expect(result.tips.map((t) => t.title)).toEqual(["Storage"]);
  });

  it("hasVideo is false when videoUrl is set but videoProvider is null (not actually playable)", async () => {
    await makeCookingTip({ title: "URL Without Provider", videoUrl: "https://youtu.be/abc123", videoProvider: null });

    const result = await listCookingTips({ page: 1, pageSize: 10 });
    const card = result.tips.find((t) => t.title === "URL Without Provider");
    expect(card?.hasVideo).toBe(false);
  });

  it("hasVideo is true when both videoUrl and videoProvider are set", async () => {
    await makeCookingTip({ title: "Full Video", videoUrl: "https://youtu.be/abc123", videoProvider: "Youtube" });

    const result = await listCookingTips({ page: 1, pageSize: 10 });
    const card = result.tips.find((t) => t.title === "Full Video");
    expect(card?.hasVideo).toBe(true);
  });
});

describe("getCookingTipBySlug", () => {
  it("returns null for missing/Draft, maps video/products/relatedTips for a real tip", async () => {
    expect(await getCookingTipBySlug("nope")).toBeNull();

    await makeCookingTip({ slug: "draft", status: "Draft" });
    expect(await getCookingTipBySlug("draft")).toBeNull();

    await makeCookingTip({ slug: "full", topicTag: "knife-skills", videoUrl: "https://youtu.be/abc", videoProvider: "Youtube" });
    await makeCookingTip({ slug: "related", topicTag: "knife-skills" });

    const result = await getCookingTipBySlug("full");
    expect(result?.video).toEqual({ url: "https://youtu.be/abc", provider: "Youtube" });
    expect(result?.relatedTips.map((t) => t.slug)).toEqual(["related"]);
  });
});

describe("listCookingTipTopics", () => {
  it("returns distinct topics with Published tips", async () => {
    await makeCookingTip({ topicTag: "knife-skills" });
    expect(await listCookingTipTopics()).toEqual([{ tag: "knife-skills" }]);
  });
});
