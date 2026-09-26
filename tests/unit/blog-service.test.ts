// tests/unit/blog-service.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  advanceCommentToApproved,
  canTransitionComment,
  changeCommentStatus,
  getPostBySlug,
  listAuthors,
  listPosts,
  listTags,
  submitComment,
} from "@/services/blog.service";
import { getRecipeCardsBySlugs } from "@/services/recipe.service";
import { cleanupRecipes, makeBlogAuthor, makeBlogComment, makeBlogPost, makeBlogTag, makeCategory, makeRecipe } from "./recipe-fixtures";

const PAST = new Date("2026-09-01T00:00:00Z");

afterEach(async () => {
  await cleanupRecipes();
});

describe("listPosts", () => {
  it("maps rows to BlogPostCardData and echoes page/pageSize", async () => {
    const author = await makeBlogAuthor({ name: "Amara Perera", slug: "amara-perera" });
    const tag = await makeBlogTag({ name: "Spices", slug: "spices" });
    await makeBlogPost({ title: "A Post", authorId: author.id, publishedAt: PAST, tagIds: [tag.id] });

    const result = await listPosts({ page: 1, pageSize: 10 });
    expect(result).toMatchObject({ page: 1, pageSize: 10, total: 1 });
    expect(result.posts[0]).toMatchObject({
      title: "A Post",
      authorName: "Amara Perera",
      authorSlug: "amara-perera",
      href: expect.stringContaining("/blog/"),
      tags: [{ name: "Spices", slug: "spices" }],
    });
  });

  it("filters by tag and author together", async () => {
    const author = await makeBlogAuthor({ slug: "author-a" });
    const otherAuthor = await makeBlogAuthor({ slug: "author-b" });
    const tag = await makeBlogTag({ slug: "spices" });
    await makeBlogPost({ title: "Match", authorId: author.id, publishedAt: PAST, tagIds: [tag.id] });
    await makeBlogPost({ title: "Wrong Author", authorId: otherAuthor.id, publishedAt: PAST, tagIds: [tag.id] });
    await makeBlogPost({ title: "Wrong Tag", authorId: author.id, publishedAt: PAST });

    const result = await listPosts({ page: 1, pageSize: 10, tag: "spices", author: "author-a" });
    expect(result.posts.map((p) => p.title)).toEqual(["Match"]);
  });
});

describe("listTags / listAuthors", () => {
  it("only returns tags/authors with a Published post", async () => {
    const author = await makeBlogAuthor({ name: "Real Author" });
    await makeBlogPost({ authorId: author.id, publishedAt: PAST });
    expect((await listAuthors()).map((a) => a.name)).toEqual(["Real Author"]);
  });
});

describe("getPostBySlug", () => {
  it("returns null for missing/Draft, and resolves embedded recipe tokens", async () => {
    expect(await getPostBySlug("nope")).toBeNull();

    const author = await makeBlogAuthor({ bio: "A great writer.", avatarUrl: "/avatar.jpg" } as never);
    const recipeCategory = await makeCategory();
    const recipe = await makeRecipe(recipeCategory.id, { title: "Embedded Recipe" });
    const draftRecipe = await makeRecipe(recipeCategory.id, { title: "Draft Recipe", status: "Draft" });

    await makeBlogPost({ slug: "draft", authorId: author.id, status: "Draft" });
    const post = await makeBlogPost({
      slug: "full-post",
      authorId: author.id,
      publishedAt: PAST,
      bodyContent: `Intro.\n\n[[recipe:${recipe.slug}]]\n\n[[recipe:${draftRecipe.slug}]]\n\nOutro.`,
    });
    await makeBlogComment({ postId: post.id, authorName: "Reader", status: "Approved" });
    await makeBlogComment({ postId: post.id, authorName: "Not Yet Approved", status: "Pending" });

    expect(await getPostBySlug("draft")).toBeNull();

    const result = await getPostBySlug("full-post");
    expect(result?.comments.map((c) => c.authorName)).toEqual(["Reader"]);
    expect(result?.recipeCards[recipe.slug]).toMatchObject({ title: "Embedded Recipe" });
    // The Draft recipe's embed must never resolve, even though it was referenced.
    expect(result?.recipeCards[draftRecipe.slug]).toBeUndefined();
  });
});

describe("canTransitionComment / changeCommentStatus", () => {
  it("allows Pending -> Approved, Pending -> Rejected, and Approved -> Hidden; nothing else", () => {
    expect(canTransitionComment("Pending", "Approved")).toBe(true);
    expect(canTransitionComment("Pending", "Rejected")).toBe(true);
    expect(canTransitionComment("Approved", "Hidden")).toBe(true);
    expect(canTransitionComment("Pending", "Hidden")).toBe(false);
    expect(canTransitionComment("Rejected", "Approved")).toBe(false);
    expect(canTransitionComment("Hidden", "Approved")).toBe(false);
  });

  it("changeCommentStatus persists an allowed transition and rejects a disallowed one", async () => {
    const author = await makeBlogAuthor();
    const post = await makeBlogPost({ authorId: author.id, publishedAt: PAST });
    const comment = await makeBlogComment({ postId: post.id, status: "Pending" });

    const approved = await changeCommentStatus(comment.id, "Approved");
    expect(approved.status).toBe("Approved");

    await expect(changeCommentStatus(comment.id, "Pending")).rejects.toThrow();
  });
});

describe("advanceCommentToApproved (dev/seed helper)", () => {
  it("walks a Pending comment to Approved", async () => {
    const author = await makeBlogAuthor();
    const post = await makeBlogPost({ authorId: author.id, publishedAt: PAST });
    const comment = await makeBlogComment({ postId: post.id, status: "Pending" });

    const result = await advanceCommentToApproved(comment.id);
    expect(result.status).toBe("Approved");
  });
});

describe("submitComment", () => {
  it("creates a Pending comment for a guest submission with name/email", async () => {
    const author = await makeBlogAuthor();
    const post = await makeBlogPost({ authorId: author.id, publishedAt: PAST });

    const result = await submitComment(post.id, { name: "Guest", email: "guest@example.com", body: "Nice post!", honeypot: "" }, null);
    expect(result).toEqual({ status: "pending-review" });

    const stored = await prisma.blogComment.findFirst({ where: { postId: post.id } });
    expect(stored).toMatchObject({ authorName: "Guest", authorEmail: "guest@example.com", status: "Pending" });
  });

  it("uses the session's identity, ignoring any client-supplied name/email, for an authenticated submission", async () => {
    const author = await makeBlogAuthor();
    const post = await makeBlogPost({ authorId: author.id, publishedAt: PAST });
    const user = await prisma.user.create({ data: { id: "cust-1", email: "real@example.com", name: "Real Customer" } });

    await submitComment(
      post.id,
      { name: "Spoofed Name", email: "spoofed@example.com", body: "Trying to spoof.", honeypot: "" },
      { userId: user.id, name: user.name, email: user.email },
    );

    const stored = await prisma.blogComment.findFirst({ where: { postId: post.id } });
    expect(stored).toMatchObject({ authorName: "Real Customer", authorEmail: "real@example.com", customerId: user.id });
  });

  it("silently no-ops on a non-empty honeypot without persisting a comment", async () => {
    const author = await makeBlogAuthor();
    const post = await makeBlogPost({ authorId: author.id, publishedAt: PAST });

    const result = await submitComment(post.id, { name: "Bot", email: "bot@example.com", body: "spam spam spam", honeypot: "gotcha" }, null);
    expect(result).toEqual({ status: "pending-review" });
    expect(await prisma.blogComment.count({ where: { postId: post.id } })).toBe(0);
  });

  it("silently no-ops a second rapid submission from the same email without persisting a duplicate", async () => {
    const author = await makeBlogAuthor();
    const post = await makeBlogPost({ authorId: author.id, publishedAt: PAST });
    const input = { name: "Repeat", email: "repeat@example.com", body: "First comment.", honeypot: "" };

    await submitComment(post.id, input, null);
    const result = await submitComment(post.id, { ...input, body: "Second, rapid comment." }, null);

    expect(result).toEqual({ status: "pending-review" });
    expect(await prisma.blogComment.count({ where: { postId: post.id } })).toBe(1);
  });
});

describe("getRecipeCardsBySlugs (recipe.service.ts)", () => {
  it("maps repository rows to RecipeCard shape, Published only", async () => {
    const recipeCategory = await makeCategory();
    const published = await makeRecipe(recipeCategory.id, { title: "Card Recipe" });
    const draft = await makeRecipe(recipeCategory.id, { title: "Draft Recipe", status: "Draft" });

    const results = await getRecipeCardsBySlugs([published.slug, draft.slug]);
    expect(results.map((r) => r.title)).toEqual(["Card Recipe"]);
    expect(results[0]).toHaveProperty("href", `/recipes/${published.slug}`);
  });
});
