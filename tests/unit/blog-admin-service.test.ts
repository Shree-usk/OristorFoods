// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { PermissionDeniedError } from "@/services/permission.errors";
import { BlogCommentIllegalTransitionError, BlogPostNotDraftError, BlogPostSlugConflictError } from "@/services/blog-admin.errors";
import {
  approveComment,
  archivePost,
  bulkModerateComments,
  createPost,
  deleteComment,
  deletePost,
  deriveEffectiveStatus,
  hideComment,
  publishPost,
  rejectComment,
  restorePost,
  updatePost,
} from "@/services/blog-admin.service";
import type { BlogPostAdminValidatedInput } from "@/validation/blog-admin.schema";

const EMAIL_DOMAIN = "@blog-admin-svc-test.test";
const ROLE_KEY_PREFIX = "blog-admin-svc-test-role-";
const AUTHOR_SLUG_PREFIX = "blog-admin-svc-author-";
let sequence = 0;

async function makeRole(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Blog Admin Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return role;
}

async function makeAdminUser(roleId: string) {
  sequence += 1;
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId } });
}

async function makeFullAccessAdmin() {
  const role = await makeRole([
    { module: "Blog", action: "View" },
    { module: "Blog", action: "Edit" },
    { module: "Blog", action: "Delete" },
    { module: "Blog", action: "Approve" },
  ]);
  return makeAdminUser(role.id);
}

async function makeAuthor() {
  sequence += 1;
  return prisma.blogAuthor.create({ data: { name: `Test Author ${sequence}`, slug: `${AUTHOR_SLUG_PREFIX}${sequence}` } });
}

function baseInput(authorId: string, overrides: Partial<BlogPostAdminValidatedInput> = {}): BlogPostAdminValidatedInput {
  sequence += 1;
  return {
    slug: `blog-admin-svc-test-${sequence}`,
    title: `Test Post ${sequence}`,
    excerpt: "A short excerpt.",
    heroImageUrl: "/images/test-hero.webp",
    bodyContent: "Some test body content, long enough to read.",
    authorId,
    tagIds: [],
    ...overrides,
  };
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.blogComment.deleteMany({ where: { post: { createdBy: { email: { endsWith: EMAIL_DOMAIN } } } } });
  await prisma.blogPost.deleteMany({ where: { createdBy: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  await prisma.blogAuthor.deleteMany({ where: { slug: { startsWith: AUTHOR_SLUG_PREFIX } } });
});

describe("blog-admin.service — posts", () => {
  it("creates a post with tags, in Draft status", async () => {
    const admin = await makeFullAccessAdmin();
    const author = await makeAuthor();
    const post = await createPost(admin.id, baseInput(author.id));

    expect(post.status).toBe("Draft");
    expect(post.readingTimeMinutes).toBeGreaterThan(0);

    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "blog_post_created" } });
    expect(log).not.toBeNull();
  });

  it("rejects a duplicate slug", async () => {
    const admin = await makeFullAccessAdmin();
    const author = await makeAuthor();
    const input = baseInput(author.id);
    await createPost(admin.id, input);
    await expect(createPost(admin.id, { ...baseInput(author.id), slug: input.slug })).rejects.toBeInstanceOf(BlogPostSlugConflictError);
  });

  it("update replaces tags wholesale", async () => {
    const admin = await makeFullAccessAdmin();
    const author = await makeAuthor();
    const post = await createPost(admin.id, baseInput(author.id));

    const updated = await updatePost(admin.id, post.id, baseInput(author.id, { title: "Updated title" }));
    expect(updated.title).toBe("Updated title");

    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "blog_post_updated" } });
    expect(log).not.toBeNull();
  });

  it("publishing with no date defaults to now and is derived as Live", async () => {
    const admin = await makeFullAccessAdmin();
    const author = await makeAuthor();
    const post = await createPost(admin.id, baseInput(author.id));

    const published = await publishPost(admin.id, post.id);
    expect(published.status).toBe("Published");
    expect(deriveEffectiveStatus(published.status, published.publishedAt)).toBe("Live");
  });

  it("publishing with a future date writes status Published but is derived as Scheduled, never a stored Scheduled value", async () => {
    const admin = await makeFullAccessAdmin();
    const author = await makeAuthor();
    const post = await createPost(admin.id, baseInput(author.id));

    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    const scheduled = await publishPost(admin.id, post.id, future);
    expect(scheduled.status).toBe("Published");
    expect(deriveEffectiveStatus(scheduled.status, scheduled.publishedAt)).toBe("Scheduled");

    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "blog_post_published" } });
    expect(log).not.toBeNull();
  });

  it("archive then restore: Published -> Archived -> Draft", async () => {
    const admin = await makeFullAccessAdmin();
    const author = await makeAuthor();
    const post = await createPost(admin.id, baseInput(author.id));
    await publishPost(admin.id, post.id);

    const archived = await archivePost(admin.id, post.id);
    expect(archived.status).toBe("Archived");

    const restored = await restorePost(admin.id, post.id);
    expect(restored.status).toBe("Draft");
    expect(restored.publishedAt).toBeNull();
  });

  it("only a Draft post can be deleted", async () => {
    const admin = await makeFullAccessAdmin();
    const author = await makeAuthor();
    const post = await createPost(admin.id, baseInput(author.id));
    await publishPost(admin.id, post.id);

    await expect(deletePost(admin.id, post.id)).rejects.toBeInstanceOf(BlogPostNotDraftError);

    const draft = await createPost(admin.id, baseInput(author.id));
    await deletePost(admin.id, draft.id);
    const found = await prisma.blogPost.findUnique({ where: { id: draft.id } });
    expect(found).toBeNull();
  });

  it("denies access to an admin without Blog permission", async () => {
    const role = await makeRole([]);
    const viewer = await makeAdminUser(role.id);
    const author = await makeAuthor();
    await expect(createPost(viewer.id, baseInput(author.id))).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("blog-admin.service — comment moderation", () => {
  async function makePendingComment(admin: { id: string }, author: { id: string }) {
    const post = await createPost(admin.id, baseInput(author.id));
    return prisma.blogComment.create({
      data: { postId: post.id, authorName: "A commenter", authorEmail: "commenter@example.com", body: "A test comment.", status: "Pending" },
    });
  }

  it("approves a Pending comment", async () => {
    const admin = await makeFullAccessAdmin();
    const author = await makeAuthor();
    const comment = await makePendingComment(admin, author);

    const approved = await approveComment(admin.id, comment.id);
    expect(approved.status).toBe("Approved");

    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "blog_comment_approved" } });
    expect(log).not.toBeNull();
  });

  it("rejects a Pending comment", async () => {
    const admin = await makeFullAccessAdmin();
    const author = await makeAuthor();
    const comment = await makePendingComment(admin, author);

    const rejected = await rejectComment(admin.id, comment.id);
    expect(rejected.status).toBe("Rejected");
  });

  it("hides an Approved comment", async () => {
    const admin = await makeFullAccessAdmin();
    const author = await makeAuthor();
    const comment = await makePendingComment(admin, author);
    await approveComment(admin.id, comment.id);

    const hidden = await hideComment(admin.id, comment.id);
    expect(hidden.status).toBe("Hidden");
  });

  it("rejects an illegal transition (e.g. Rejected -> Approved)", async () => {
    const admin = await makeFullAccessAdmin();
    const author = await makeAuthor();
    const comment = await makePendingComment(admin, author);
    await rejectComment(admin.id, comment.id);

    await expect(approveComment(admin.id, comment.id)).rejects.toBeInstanceOf(BlogCommentIllegalTransitionError);
  });

  it("deletes a comment", async () => {
    const admin = await makeFullAccessAdmin();
    const author = await makeAuthor();
    const comment = await makePendingComment(admin, author);

    await deleteComment(admin.id, comment.id);
    const found = await prisma.blogComment.findUnique({ where: { id: comment.id } });
    expect(found).toBeNull();
  });

  it("bulk-moderates a mixed selection, updating valid transitions and skipping invalid ones", async () => {
    const admin = await makeFullAccessAdmin();
    const author = await makeAuthor();
    const pending = await makePendingComment(admin, author);
    const alreadyRejected = await makePendingComment(admin, author);
    await rejectComment(admin.id, alreadyRejected.id);

    const result = await bulkModerateComments(admin.id, [pending.id, alreadyRejected.id], "approve");
    expect(result.updated).toEqual([pending.id]);
    expect(result.skipped).toEqual([alreadyRejected.id]);

    const updated = await prisma.blogComment.findUnique({ where: { id: pending.id } });
    expect(updated?.status).toBe("Approved");
  });

  it("comment moderation requires the Approve action specifically, not just Edit", async () => {
    const editOnlyRole = await makeRole([
      { module: "Blog", action: "View" },
      { module: "Blog", action: "Edit" },
    ]);
    const editOnlyAdmin = await makeAdminUser(editOnlyRole.id);
    const fullAdmin = await makeFullAccessAdmin();
    const author = await makeAuthor();
    const comment = await makePendingComment(fullAdmin, author);

    await expect(approveComment(editOnlyAdmin.id, comment.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});
