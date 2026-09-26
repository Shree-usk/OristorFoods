// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Session } from "next-auth";
import { prisma } from "@/lib/db";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
const { auth } = await import("@/lib/auth");
const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;

const { GET: getPosts } = await import("@/app/api/blog/route");
const { GET: getPost } = await import("@/app/api/blog/[slug]/route");
const { POST: postComment } = await import("@/app/api/blog/[slug]/comments/route");

import { cleanupRecipes, makeBlogAuthor, makeBlogPost } from "./recipe-fixtures";

const PAST = new Date("2026-09-01T00:00:00Z");

afterEach(async () => {
  mockAuth.mockReset();
  await cleanupRecipes();
});

function sessionFor(userId: string): Session {
  return { user: { id: userId, name: "Test User", email: "test@example.com", image: null }, expires: "2099-01-01T00:00:00.000Z" };
}

describe("GET /api/blog", () => {
  it("returns Published posts with paging metadata", async () => {
    const author = await makeBlogAuthor();
    await makeBlogPost({ title: "Published Post", authorId: author.id, publishedAt: PAST });
    await makeBlogPost({ title: "Draft Post", authorId: author.id, status: "Draft" });

    const response = await getPosts(new Request("http://localhost/api/blog"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.posts.map((p: { title: string }) => p.title)).toEqual(["Published Post"]);
  });
});

describe("GET /api/blog/[slug]", () => {
  it("returns 200 for a Published slug, 404 for missing/Draft", async () => {
    const author = await makeBlogAuthor();
    await makeBlogPost({ slug: "published-post", authorId: author.id, publishedAt: PAST });
    await makeBlogPost({ slug: "draft-post", authorId: author.id, status: "Draft" });

    const ok = await getPost(new Request("http://localhost/api/blog/published-post"), { params: Promise.resolve({ slug: "published-post" }) });
    expect(ok.status).toBe(200);

    const draftResponse = await getPost(new Request("http://localhost/api/blog/draft-post"), { params: Promise.resolve({ slug: "draft-post" }) });
    expect(draftResponse.status).toBe(404);
  });
});

describe("POST /api/blog/[slug]/comments", () => {
  it("accepts a guest submission and returns the pending-review acknowledgement, never the comment itself", async () => {
    mockAuth.mockResolvedValue(null);
    const author = await makeBlogAuthor();
    const post = await makeBlogPost({ slug: "commentable-post", authorId: author.id, publishedAt: PAST });

    const request = new Request("http://localhost/api/blog/commentable-post/comments", {
      method: "POST",
      body: JSON.stringify({ name: "Guest", email: "guest@example.com", body: "Nice post!", honeypot: "" }),
    });
    const response = await postComment(request, { params: Promise.resolve({ slug: "commentable-post" }) });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "pending-review" });
    expect(await prisma.blogComment.count({ where: { postId: post.id } })).toBe(1);
  });

  it("returns 404 when the post slug does not resolve to a Published post", async () => {
    mockAuth.mockResolvedValue(null);
    const request = new Request("http://localhost/api/blog/does-not-exist/comments", {
      method: "POST",
      body: JSON.stringify({ name: "Guest", email: "guest@example.com", body: "Hello", honeypot: "" }),
    });
    const response = await postComment(request, { params: Promise.resolve({ slug: "does-not-exist" }) });
    expect(response.status).toBe(404);
  });

  it("returns 400 for a body that fails validation", async () => {
    mockAuth.mockResolvedValue(null);
    const author = await makeBlogAuthor();
    await makeBlogPost({ slug: "commentable-post-2", authorId: author.id, publishedAt: PAST });

    const request = new Request("http://localhost/api/blog/commentable-post-2/comments", {
      method: "POST",
      body: JSON.stringify({ name: "Guest", email: "not-an-email", body: "Hi", honeypot: "" }),
    });
    const response = await postComment(request, { params: Promise.resolve({ slug: "commentable-post-2" }) });
    expect(response.status).toBe(400);
  });

  it("uses the session's identity when a session is present, ignoring the client-supplied name/email", async () => {
    const user = await prisma.user.create({ data: { email: "real@example.com", name: "Real Customer" } });
    mockAuth.mockResolvedValue(sessionFor(user.id));
    const author = await makeBlogAuthor();
    const post = await makeBlogPost({ slug: "commentable-post-3", authorId: author.id, publishedAt: PAST });

    const request = new Request("http://localhost/api/blog/commentable-post-3/comments", {
      method: "POST",
      body: JSON.stringify({ name: "Spoofed", email: "spoofed@example.com", body: "A real comment.", honeypot: "" }),
    });
    await postComment(request, { params: Promise.resolve({ slug: "commentable-post-3" }) });

    const stored = await prisma.blogComment.findFirst({ where: { postId: post.id } });
    expect(stored).toMatchObject({ authorName: "Real Customer", authorEmail: "real@example.com", customerId: user.id });
  });
});
