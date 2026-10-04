// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { PermissionDeniedError } from "@/services/permission.errors";
import { getPublishedStoryBlocks, getStoryPageBlocksForAdmin, saveStoryPageBlocks } from "@/services/story-page.service";

const EMAIL_DOMAIN = "@story-page-svc-test.test";
const ROLE_KEY_PREFIX = "story-page-svc-test-role-";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Story Page Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

function makeFullAccessAdmin() {
  return makeAdmin([
    { module: "StoryPages", action: "View" },
    { module: "StoryPages", action: "Edit" },
  ]);
}

const TEST_BLOCK_KEY = "story-page-svc-test-hero";

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.storyPageBlock.deleteMany({ where: { blockKey: TEST_BLOCK_KEY } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("story-page.service", () => {
  it("rejects a non-permitted admin's read and write", async () => {
    const noPermission = await makeAdmin([]);
    await expect(getStoryPageBlocksForAdmin(noPermission.id, "AboutUs")).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(saveStoryPageBlocks(noPermission.id, "AboutUs", [])).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("saveStoryPageBlocks upserts by (page, blockKey) idempotently — no duplicate rows on re-save", async () => {
    const admin = await makeFullAccessAdmin();
    const block = { blockKey: TEST_BLOCK_KEY, blockType: "Hero" as const, sortOrder: 0, title: "First save" };

    await saveStoryPageBlocks(admin.id, "AboutUs", [block]);
    await saveStoryPageBlocks(admin.id, "AboutUs", [{ ...block, title: "Second save" }]);

    const rows = await prisma.storyPageBlock.findMany({ where: { blockKey: TEST_BLOCK_KEY } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe("Second save");
  });

  it("writes an audit log entry on save", async () => {
    const admin = await makeFullAccessAdmin();
    await saveStoryPageBlocks(admin.id, "AboutUs", [{ blockKey: TEST_BLOCK_KEY, blockType: "Hero", sortOrder: 0, title: "Audit test" }]);

    const logCount = await prisma.auditLog.count({ where: { actorId: admin.id, action: "story_page_blocks_updated", module: "StoryPages" } });
    expect(logCount).toBe(1);
  });

  it("getPublishedStoryBlocks (storefront-facing) requires no permission and reflects a saved write", async () => {
    const admin = await makeFullAccessAdmin();
    await saveStoryPageBlocks(admin.id, "AboutUs", [{ blockKey: TEST_BLOCK_KEY, blockType: "Hero", sortOrder: 0, title: "Published read test" }]);

    const blocks = await getPublishedStoryBlocks("AboutUs");
    expect(blocks.some((block) => block.blockKey === TEST_BLOCK_KEY && block.title === "Published read test")).toBe(true);
  });
});
