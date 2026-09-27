// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { findPublishedRecipesBySlugs } from "@/repositories/recipe.repository";
import {
  createBlogComment,
  findActiveBlogAuthorsWithPublishedPosts,
  findActiveBlogTags,
  findPublishedBlogPostBySlug,
  findPublishedBlogPosts,
  findRecentCommentByIdentity,
  findRelatedBlogPosts,
} from "@/repositories/blog.repository";
import { cleanupRecipes, makeBlogAuthor, makeBlogComment, makeBlogPost, makeBlogTag, makeCategory, makeRecipe } from "./recipe-fixtures";

const PAST = new Date("2026-09-01T00:00:00Z");
const FUTURE = new Date("2099-01-01T00:00:00Z");

afterEach(async () => {
  await cleanupRecipes();
});

describe("findPublishedBlogPosts", () => {
  it("excludes Draft, Archived, and Published-but-future-dated posts", async () => {
    const author = await makeBlogAuthor();
    await makeBlogPost({ title: "Real Published", authorId: author.id, publishedAt: PAST });
    await makeBlogPost({ title: "Draft Post", authorId: author.id, status: "Draft" });
    await makeBlogPost({ title: "Archived Post", authorId: author.id, status: "Archived", publishedAt: PAST });
    await makeBlogPost({ title: "Scheduled Future", authorId: author.id, status: "Published", publishedAt: FUTURE });

    const result = await findPublishedBlogPosts({ where: {}, skip: 0, take: 10 });
    expect(result.rows.map((r) => r.title)).toEqual(["Real Published"]);
  });

  it("cannot be overridden by a caller-supplied status or publishedAt filter", async () => {
    const author = await makeBlogAuthor();
    await makeBlogPost({ title: "Real Published", authorId: author.id, publishedAt: PAST });
    await makeBlogPost({ title: "Sneaky Draft", authorId: author.id, status: "Draft" });

    const result = await findPublishedBlogPosts({
      where: { status: "Draft", publishedAt: { gte: FUTURE } } as never,
      skip: 0,
      take: 10,
    });
    expect(result.rows.map((r) => r.title)).toEqual(["Real Published"]);
  });

  it("filters by tag and by author", async () => {
    const author1 = await makeBlogAuthor({ slug: "author-one" });
    const author2 = await makeBlogAuthor({ slug: "author-two" });
    const tag = await makeBlogTag({ slug: "spices" });
    await makeBlogPost({ title: "Tagged, Author One", authorId: author1.id, publishedAt: PAST, tagIds: [tag.id] });
    await makeBlogPost({ title: "Untagged, Author One", authorId: author1.id, publishedAt: PAST });
    await makeBlogPost({ title: "Tagged, Author Two", authorId: author2.id, publishedAt: PAST, tagIds: [tag.id] });

    const byTag = await findPublishedBlogPosts({ where: { tags: { some: { tag: { slug: "spices" } } } }, skip: 0, take: 10 });
    expect(byTag.rows.map((r) => r.title).sort()).toEqual(["Tagged, Author One", "Tagged, Author Two"]);

    const byAuthor = await findPublishedBlogPosts({ where: { author: { slug: "author-one" } }, skip: 0, take: 10 });
    expect(byAuthor.rows.map((r) => r.title).sort()).toEqual(["Tagged, Author One", "Untagged, Author One"]);
  });
});

describe("findPublishedBlogPostBySlug", () => {
  it("returns null for a missing, Draft, or future-dated slug", async () => {
    const author = await makeBlogAuthor();
    await makeBlogPost({ slug: "draft-post", authorId: author.id, status: "Draft" });
    await makeBlogPost({ slug: "future-post", authorId: author.id, status: "Published", publishedAt: FUTURE });
    expect(await findPublishedBlogPostBySlug("draft-post")).toBeNull();
    expect(await findPublishedBlogPostBySlug("future-post")).toBeNull();
    expect(await findPublishedBlogPostBySlug("does-not-exist")).toBeNull();
  });

  it("only includes Approved comments, never Pending/Rejected/Hidden", async () => {
    const author = await makeBlogAuthor();
    const post = await makeBlogPost({ slug: "commented-post", authorId: author.id, publishedAt: PAST });
    await makeBlogComment({ postId: post.id, authorName: "Visible", status: "Approved" });
    await makeBlogComment({ postId: post.id, authorName: "Hidden Pending", status: "Pending" });
    await makeBlogComment({ postId: post.id, authorName: "Hidden Rejected", status: "Rejected" });
    await makeBlogComment({ postId: post.id, authorName: "Hidden Hidden", status: "Hidden" });

    const result = await findPublishedBlogPostBySlug("commented-post");
    expect(result?.comments.map((c) => c.authorName)).toEqual(["Visible"]);
  });
});

describe("findRelatedBlogPosts", () => {
  it("prefers same-author/tag posts, then tops up with other recent Published posts", async () => {
    const author = await makeBlogAuthor();
    const otherAuthor = await makeBlogAuthor();
    const tag = await makeBlogTag();
    const target = await makeBlogPost({ slug: "target", authorId: author.id, publishedAt: PAST, tagIds: [tag.id] });
    const sameTag = await makeBlogPost({ slug: "same-tag", authorId: otherAuthor.id, publishedAt: PAST, tagIds: [tag.id] });
    const unrelated = await makeBlogPost({ slug: "unrelated", authorId: otherAuthor.id, publishedAt: PAST });
    await makeBlogPost({ slug: "draft-unrelated", authorId: otherAuthor.id, status: "Draft" });

    const related = await findRelatedBlogPosts({ id: target.id, authorId: author.id, tagIds: [tag.id] }, 3);
    expect(related.map((r) => r.slug).sort()).toEqual(["same-tag", "unrelated"].sort());
    expect(related.map((r) => r.slug)).not.toContain("target");
  });
});

describe("findActiveBlogTags / findActiveBlogAuthorsWithPublishedPosts", () => {
  it("excludes a tag or author whose only posts are not Published-and-past-dated", async () => {
    const author = await makeBlogAuthor({ name: "Published Author" });
    const draftOnlyAuthor = await makeBlogAuthor({ name: "Draft-Only Author" });
    const tag = await makeBlogTag({ name: "Published Tag" });
    const draftOnlyTag = await makeBlogTag({ name: "Draft-Only Tag" });
    await makeBlogPost({ authorId: author.id, publishedAt: PAST, tagIds: [tag.id] });
    await makeBlogPost({ authorId: draftOnlyAuthor.id, status: "Draft", tagIds: [draftOnlyTag.id] });

    expect((await findActiveBlogAuthorsWithPublishedPosts()).map((a) => a.name)).toEqual(["Published Author"]);
    expect((await findActiveBlogTags()).map((t) => t.name)).toEqual(["Published Tag"]);
  });
});

describe("comment persistence and rate-limit lookup", () => {
  it("createBlogComment always persists as Pending — its input type has no status field to override with", async () => {
    const author = await makeBlogAuthor();
    const post = await makeBlogPost({ authorId: author.id, publishedAt: PAST });
    const comment = await createBlogComment({
      postId: post.id,
      authorName: "Test",
      authorEmail: "test@example.com",
      body: "Hello",
    });
    expect(comment.status).toBe("Pending");
  });

  it("findRecentCommentByIdentity finds a comment within the window and not outside it", async () => {
    const author = await makeBlogAuthor();
    const post = await makeBlogPost({ authorId: author.id, publishedAt: PAST });
    await createBlogComment({ postId: post.id, authorName: "T", authorEmail: "rate@example.com", body: "First" });

    const found = await findRecentCommentByIdentity(post.id, { authorEmail: "rate@example.com" }, new Date(Date.now() - 60_000));
    expect(found).not.toBeNull();

    const notFound = await findRecentCommentByIdentity(post.id, { authorEmail: "someone-else@example.com" }, new Date(Date.now() - 60_000));
    expect(notFound).toBeNull();
  });
});

describe("findPublishedRecipesBySlugs (recipe.repository.ts)", () => {
  it("only returns Published recipes matching the given slugs", async () => {
    const recipeCategory = await makeCategory();
    const published = await makeRecipe(recipeCategory.id, { title: "Published Recipe" });
    const draft = await makeRecipe(recipeCategory.id, { title: "Draft Recipe", status: "Draft" });

    const results = await findPublishedRecipesBySlugs([published.slug, draft.slug, "does-not-exist"]);
    expect(results.map((r) => r.title)).toEqual(["Published Recipe"]);
  });
});
