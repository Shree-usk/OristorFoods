// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { PermissionDeniedError } from "@/services/permission.errors";
import {
  ReviewModerationFeatureNotSupportedError,
  ReviewModerationIllegalTransitionError,
  ReviewModerationRewardTargetInvalidError,
} from "@/services/review-moderation.errors";
import { approve, bulkModerate, hide, publish, reject, reply, restore, rewardCustomer, setFeatured } from "@/services/review-moderation.service";

const EMAIL_DOMAIN = "@review-moderation-svc-test.test";
const ROLE_KEY_PREFIX = "review-moderation-svc-test-role-";
const SLUG_PREFIX = "review-moderation-svc-test-";
let sequence = 0;

async function makeRole(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Review Moderation Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return role;
}

async function makeAdminUser(roleId: string) {
  sequence += 1;
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId } });
}

async function makeFullAccessAdmin() {
  const role = await makeRole([
    { module: "Reviews", action: "View" },
    { module: "Reviews", action: "Edit" },
    { module: "Reviews", action: "Approve" },
  ]);
  return makeAdminUser(role.id);
}

async function makeCustomer() {
  sequence += 1;
  return prisma.user.create({ data: { email: `customer-${sequence}${EMAIL_DOMAIN}`, name: `Test Customer ${sequence}` } });
}

async function makeProduct() {
  sequence += 1;
  return prisma.product.create({ data: { sku: `${SLUG_PREFIX}${sequence}`, slug: `${SLUG_PREFIX}${sequence}`, name: `Test Product ${sequence}`, status: "Published" } });
}

async function makePendingReview() {
  const product = await makeProduct();
  const customer = await makeCustomer();
  const review = await prisma.review.create({ data: { productId: product.id, userId: customer.id, rating: 5, title: "Great", body: "Really great product.", status: "Pending" } });
  return { review, product, customer };
}

async function makeRecipeCategory() {
  sequence += 1;
  return prisma.recipeCategory.create({ data: { name: `Test Category ${sequence}`, slug: `${SLUG_PREFIX}cat-${sequence}` } });
}

async function makePendingRecipeReview() {
  const category = await makeRecipeCategory();
  sequence += 1;
  const recipe = await prisma.recipe.create({
    data: {
      slug: `${SLUG_PREFIX}recipe-${sequence}`,
      title: `Test Recipe ${sequence}`,
      shortDescription: "A test recipe.",
      heroImage: "/images/test.webp",
      heroImageAlt: "test",
      categoryId: category.id,
      difficulty: "Easy",
      prepTimeMinutes: 10,
      cookTimeMinutes: 10,
      totalTimeMinutes: 20,
      servings: 2,
      status: "Published",
    },
  });
  const customer = await makeCustomer();
  const review = await prisma.recipeReview.create({ data: { recipeId: recipe.id, customerId: customer.id, rating: 4, reviewText: "Tasty.", status: "Pending" } });
  return { review, recipe, customer };
}

async function makeBlogAuthor() {
  sequence += 1;
  return prisma.blogAuthor.create({ data: { name: `Test Author ${sequence}`, slug: `${SLUG_PREFIX}author-${sequence}` } });
}

async function makePendingComment(withCustomer = true) {
  const author = await makeBlogAuthor();
  sequence += 1;
  const post = await prisma.blogPost.create({ data: { slug: `${SLUG_PREFIX}post-${sequence}`, title: `Test Post ${sequence}`, excerpt: "An excerpt.", bodyContent: "Body.", authorId: author.id } });
  const customer = withCustomer ? await makeCustomer() : null;
  const comment = await prisma.blogComment.create({
    data: { postId: post.id, authorName: "A commenter", authorEmail: "commenter@example.com", customerId: customer?.id, body: "A test comment.", status: "Pending" },
  });
  return { comment, post, customer };
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.rewardTransaction.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.rewardAccount.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.productRatingSummary.deleteMany();
  await prisma.review.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.product.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
  await prisma.recipeReview.deleteMany({ where: { customer: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.recipe.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
  await prisma.recipeCategory.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
  await prisma.blogComment.deleteMany({ where: { post: { slug: { startsWith: SLUG_PREFIX } } } });
  await prisma.blogPost.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
  await prisma.blogAuthor.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("review-moderation.service — approve/reject/hide across sources", () => {
  it("approves a product review (Pending -> Approved), without yet making it publicly visible", async () => {
    const admin = await makeFullAccessAdmin();
    const { review } = await makePendingReview();

    const result = await approve(admin.id, "product", review.id);
    expect(result.status).toBe("Approved");

    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "review_approved" } });
    expect(log).not.toBeNull();
  });

  it("publishing a product review requires going through Approved first", async () => {
    const admin = await makeFullAccessAdmin();
    const { review } = await makePendingReview();

    await expect(publish(admin.id, review.id)).rejects.toBeInstanceOf(ReviewModerationIllegalTransitionError);

    await approve(admin.id, "product", review.id);
    const published = await publish(admin.id, review.id);
    expect(published.status).toBe("Published");
  });

  it("approves a recipe review (Pending -> Approved), which IS the publicly visible state, and recalculates Recipe.avgRating", async () => {
    const admin = await makeFullAccessAdmin();
    const { review, recipe } = await makePendingRecipeReview();

    const result = await approve(admin.id, "recipe", review.id);
    expect(result.status).toBe("Approved");

    const updatedRecipe = await prisma.recipe.findUnique({ where: { id: recipe.id } });
    expect(updatedRecipe?.ratingCount).toBe(1);
  });

  it("approves a blog comment (Pending -> Approved), with no recalculation involved", async () => {
    const admin = await makeFullAccessAdmin();
    const { comment } = await makePendingComment();

    const result = await approve(admin.id, "blog-comment", comment.id);
    expect(result.status).toBe("Approved");
  });

  it("hides a published product review (Published -> Hidden) and can restore it back to Published", async () => {
    const admin = await makeFullAccessAdmin();
    const { review } = await makePendingReview();
    await approve(admin.id, "product", review.id);
    await publish(admin.id, review.id);

    const hidden = await hide(admin.id, "product", review.id);
    expect(hidden.status).toBe("Hidden");

    const restored = await restore(admin.id, review.id);
    expect(restored.status).toBe("Published");
  });

  it("hides an approved recipe review (Approved -> Hidden); Hidden is terminal, matching STORY-022's own design", async () => {
    const admin = await makeFullAccessAdmin();
    const { review } = await makePendingRecipeReview();
    await approve(admin.id, "recipe", review.id);

    const hidden = await hide(admin.id, "recipe", review.id);
    expect(hidden.status).toBe("Hidden");
  });

  it("rejects a Pending item for all three source types", async () => {
    const admin = await makeFullAccessAdmin();
    const { review: productReview } = await makePendingReview();
    const { review: recipeReview } = await makePendingRecipeReview();
    const { comment } = await makePendingComment();

    expect((await reject(admin.id, "product", productReview.id)).status).toBe("Rejected");
    expect((await reject(admin.id, "recipe", recipeReview.id)).status).toBe("Rejected");
    expect((await reject(admin.id, "blog-comment", comment.id)).status).toBe("Rejected");
  });

  it("denies access to an admin without Reviews permission", async () => {
    const role = await makeRole([]);
    const viewer = await makeAdminUser(role.id);
    const { review } = await makePendingReview();
    await expect(approve(viewer.id, "product", review.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("review-moderation.service — reply and feature", () => {
  it("saves a reply for all three source types", async () => {
    const admin = await makeFullAccessAdmin();
    const { review: productReview } = await makePendingReview();
    const { review: recipeReview } = await makePendingRecipeReview();
    const { comment } = await makePendingComment();

    expect((await reply(admin.id, "product", productReview.id, "Thanks for the feedback!")).adminReplyBody).toBe("Thanks for the feedback!");
    expect((await reply(admin.id, "recipe", recipeReview.id, "Glad you liked it!")).adminReplyBody).toBe("Glad you liked it!");
    expect((await reply(admin.id, "blog-comment", comment.id, "Appreciate the comment!")).adminReplyBody).toBe("Appreciate the comment!");
  });

  it("features a product review and a recipe review", async () => {
    const admin = await makeFullAccessAdmin();
    const { review: productReview } = await makePendingReview();
    const { review: recipeReview } = await makePendingRecipeReview();

    expect((await setFeatured(admin.id, "product", productReview.id, true)).featured).toBe(true);
    expect((await setFeatured(admin.id, "recipe", recipeReview.id, true)).featured).toBe(true);
  });

  it("rejects featuring a blog comment — comments have no rating/quote to curate", async () => {
    const admin = await makeFullAccessAdmin();
    const { comment } = await makePendingComment();
    await expect(setFeatured(admin.id, "blog-comment", comment.id, true)).rejects.toBeInstanceOf(ReviewModerationFeatureNotSupportedError);
  });
});

describe("review-moderation.service — reward customer", () => {
  it("grants manual reward points to the submitting customer, writing an orderId: null transaction", async () => {
    const admin = await makeFullAccessAdmin();
    const { review, customer } = await makePendingReview();

    await rewardCustomer(admin.id, "product", review.id, 250, "Great detailed review");

    const transaction = await prisma.rewardTransaction.findFirst({ where: { userId: customer.id, type: "Earned", orderId: null } });
    expect(transaction?.points).toBe(250);
    expect(transaction?.note).toBe("Great detailed review");

    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "review_customer_rewarded" } });
    expect(log).not.toBeNull();
  });

  it("rejects rewarding a guest blog comment — no registered customer to credit", async () => {
    const admin = await makeFullAccessAdmin();
    const { comment } = await makePendingComment(false);
    await expect(rewardCustomer(admin.id, "blog-comment", comment.id, 100, "Thanks")).rejects.toBeInstanceOf(ReviewModerationRewardTargetInvalidError);
  });
});

describe("review-moderation.service — bulk moderation", () => {
  it("bulk-approves a mixed selection across source types, skipping an item that's not actually Pending", async () => {
    const admin = await makeFullAccessAdmin();
    const { review: productReview } = await makePendingReview();
    const { review: recipeReview } = await makePendingRecipeReview();
    await reject(admin.id, "recipe", recipeReview.id); // no longer Pending — approving it should be skipped

    const result = await bulkModerate(
      admin.id,
      [
        { sourceType: "product", id: productReview.id },
        { sourceType: "recipe", id: recipeReview.id },
      ],
      "approve",
    );

    expect(result.updated).toEqual([{ sourceType: "product", id: productReview.id }]);
    expect(result.skipped).toEqual([{ sourceType: "recipe", id: recipeReview.id }]);
  });
});
