// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getMyReviewQueue } from "@/services/review-queue.service";
import { makeCategory, cleanupRecipes, makeRecipe } from "./recipe-fixtures";

const EMAIL_DOMAIN = "@review-queue-svc-test.test";
const ROLE_KEY_PREFIX = "review-queue-svc-test-role-";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Review Queue Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

afterEach(async () => {
  await cleanupRecipes();
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("review-queue.service — getMyReviewQueue", () => {
  it("includes a Recipe in Review status for an admin with Recipes:Approve, and excludes it for one without", async () => {
    const category = await makeCategory();
    const recipe = await makeRecipe(category.id, { status: "Review" });

    const approver = await makeAdmin([{ module: "Recipes", action: "Approve" }]);
    const viewer = await makeAdmin([{ module: "Recipes", action: "View" }]);

    const approverQueue = await getMyReviewQueue(approver.id);
    expect(approverQueue.some((item) => item.sourceType === "Recipe" && item.id === recipe.id)).toBe(true);

    const viewerQueue = await getMyReviewQueue(viewer.id);
    expect(viewerQueue.some((item) => item.sourceType === "Recipe" && item.id === recipe.id)).toBe(false);
  });

  it("excludes a Published recipe even for an admin with Recipes:Approve — only Review-status items are queued", async () => {
    const category = await makeCategory();
    const recipe = await makeRecipe(category.id, { status: "Published" });
    const approver = await makeAdmin([{ module: "Recipes", action: "Approve" }]);

    const queue = await getMyReviewQueue(approver.id);
    expect(queue.some((item) => item.id === recipe.id)).toBe(false);
  });
});
