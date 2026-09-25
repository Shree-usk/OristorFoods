// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { GET as getCookingTips } from "@/app/api/cooking-tips/route";
import { GET as getCookingTip } from "@/app/api/cooking-tips/[slug]/route";
import { cleanupRecipes, makeCookingTip } from "./recipe-fixtures";

afterEach(async () => {
  await cleanupRecipes();
});

describe("GET /api/cooking-tips", () => {
  it("returns Published tips with paging metadata", async () => {
    await makeCookingTip({ title: "Published Tip" });
    await makeCookingTip({ title: "Draft Tip", status: "Draft" });

    const response = await getCookingTips(new Request("http://localhost/api/cooking-tips"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.tips.map((t: { title: string }) => t.title)).toEqual(["Published Tip"]);
  });
});

describe("GET /api/cooking-tips/[slug]", () => {
  it("returns 200 for a Published slug, 404 for missing/Draft", async () => {
    await makeCookingTip({ slug: "published-tip" });
    await makeCookingTip({ slug: "draft-tip", status: "Draft" });

    const ok = await getCookingTip(new Request("http://localhost/api/cooking-tips/published-tip"), {
      params: Promise.resolve({ slug: "published-tip" }),
    });
    expect(ok.status).toBe(200);

    const draftResponse = await getCookingTip(new Request("http://localhost/api/cooking-tips/draft-tip"), {
      params: Promise.resolve({ slug: "draft-tip" }),
    });
    expect(draftResponse.status).toBe(404);
  });
});
