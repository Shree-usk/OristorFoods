// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createPolicyDocument, deletePolicyDocument, getPolicyDocumentBySlug, listPolicyDocuments, updatePolicyDocument } from "@/services/policy-document.service";
import { PolicyDocumentDuplicateSlugError, PolicyDocumentNotFoundError } from "@/services/policy-document.errors";
import { PermissionDeniedError } from "@/services/permission.errors";

const EMAIL_DOMAIN = "@policy-document-svc-test.test";
const ROLE_KEY_PREFIX = "policy-document-svc-test-role-";
const SLUG_PREFIX = "policy-document-svc-slug-";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Policy Doc Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

afterEach(async () => {
  await prisma.policyDocument.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("policy-document.service — CRUD + permission gating", () => {
  it("creates, lists, updates, and deletes a document for an admin with SystemSettings:Edit/View", async () => {
    sequence += 1;
    const admin = await makeAdmin([{ module: "SystemSettings", action: "View" }, { module: "SystemSettings", action: "Edit" }]);
    const slug = `${SLUG_PREFIX}${sequence}`;

    const created = await createPolicyDocument(admin.id, { slug, title: "Returns & Refunds", content: "Original content." });
    expect(created.slug).toBe(slug);

    const listed = await listPolicyDocuments(admin.id);
    expect(listed.map((row) => row.id)).toContain(created.id);

    const updated = await updatePolicyDocument(admin.id, created.id, { content: "Updated content." });
    expect(updated.content).toBe("Updated content.");

    await deletePolicyDocument(admin.id, created.id);
    const afterDelete = await listPolicyDocuments(admin.id);
    expect(afterDelete.map((row) => row.id)).not.toContain(created.id);
  });

  it("requires SystemSettings:Edit to create", async () => {
    sequence += 1;
    const viewOnlyAdmin = await makeAdmin([{ module: "SystemSettings", action: "View" }]);
    await expect(createPolicyDocument(viewOnlyAdmin.id, { slug: `${SLUG_PREFIX}${sequence}`, title: "x", content: "x" })).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects a duplicate slug", async () => {
    sequence += 1;
    const admin = await makeAdmin([{ module: "SystemSettings", action: "Edit" }]);
    const slug = `${SLUG_PREFIX}${sequence}`;
    await createPolicyDocument(admin.id, { slug, title: "Returns", content: "x" });

    await expect(createPolicyDocument(admin.id, { slug, title: "Returns 2", content: "y" })).rejects.toBeInstanceOf(PolicyDocumentDuplicateSlugError);
  });

  it("throws on updating/deleting a document that doesn't exist", async () => {
    const admin = await makeAdmin([{ module: "SystemSettings", action: "Edit" }]);
    await expect(updatePolicyDocument(admin.id, "nonexistent-id", { title: "x" })).rejects.toBeInstanceOf(PolicyDocumentNotFoundError);
    await expect(deletePolicyDocument(admin.id, "nonexistent-id")).rejects.toBeInstanceOf(PolicyDocumentNotFoundError);
  });
});

describe("policy-document.service — getPolicyDocumentBySlug", () => {
  it("returns null, not a fabricated document, when nothing has been authored for that slug", async () => {
    const document = await getPolicyDocumentBySlug("a-slug-nobody-has-created");
    expect(document).toBeNull();
  });

  it("returns the real content for an authored slug", async () => {
    sequence += 1;
    const admin = await makeAdmin([{ module: "SystemSettings", action: "Edit" }]);
    const slug = `${SLUG_PREFIX}${sequence}`;
    await createPolicyDocument(admin.id, { slug, title: "Returns", content: "Real policy text." });

    const document = await getPolicyDocumentBySlug(slug);
    expect(document?.content).toBe("Real policy text.");
  });
});
