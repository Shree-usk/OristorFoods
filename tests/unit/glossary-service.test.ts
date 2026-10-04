// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createGlossaryTerm, deleteGlossaryTerm, expandQuery, listGlossaryTerms, updateGlossaryTerm } from "@/services/glossary.service";
import { GlossaryTermDuplicateError, GlossaryTermNotFoundError } from "@/services/glossary.errors";
import { PermissionDeniedError } from "@/services/permission.errors";

const EMAIL_DOMAIN = "@glossary-svc-test.test";
const ROLE_KEY_PREFIX = "glossary-svc-test-role-";
const TERM_PREFIX = "glossary-svc-term-";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Glossary Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

afterEach(async () => {
  await prisma.searchGlossaryTerm.deleteMany({ where: { term: { startsWith: TERM_PREFIX } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("glossary.service — CRUD + permission gating", () => {
  it("creates, lists, updates, and deletes a term for an admin with Products:Edit/Delete", async () => {
    sequence += 1;
    const admin = await makeAdmin([{ module: "Products", action: "View" }, { module: "Products", action: "Edit" }, { module: "Products", action: "Delete" }]);
    const term = `${TERM_PREFIX}${sequence}`;

    const created = await createGlossaryTerm(admin.id, { term, canonicalTerm: "spicy", targetType: null, targetId: null });
    expect(created.term).toBe(term);

    const listed = await listGlossaryTerms(admin.id);
    expect(listed.map((row) => row.id)).toContain(created.id);

    const updated = await updateGlossaryTerm(admin.id, created.id, { canonicalTerm: "hot" });
    expect(updated.canonicalTerm).toBe("hot");

    await deleteGlossaryTerm(admin.id, created.id);
    const afterDelete = await listGlossaryTerms(admin.id);
    expect(afterDelete.map((row) => row.id)).not.toContain(created.id);
  });

  it("requires Products:Edit to create", async () => {
    sequence += 1;
    const viewOnlyAdmin = await makeAdmin([{ module: "Products", action: "View" }]);
    await expect(createGlossaryTerm(viewOnlyAdmin.id, { term: `${TERM_PREFIX}${sequence}`, canonicalTerm: "x", targetType: null, targetId: null })).rejects.toBeInstanceOf(
      PermissionDeniedError,
    );
  });

  it("rejects a duplicate term", async () => {
    sequence += 1;
    const admin = await makeAdmin([{ module: "Products", action: "Edit" }]);
    const term = `${TERM_PREFIX}${sequence}`;
    await createGlossaryTerm(admin.id, { term, canonicalTerm: "spicy", targetType: null, targetId: null });

    await expect(createGlossaryTerm(admin.id, { term, canonicalTerm: "hot", targetType: null, targetId: null })).rejects.toBeInstanceOf(GlossaryTermDuplicateError);
  });

  it("throws on updating/deleting a term that doesn't exist", async () => {
    const admin = await makeAdmin([{ module: "Products", action: "Edit" }, { module: "Products", action: "Delete" }]);
    await expect(updateGlossaryTerm(admin.id, "nonexistent-id", { canonicalTerm: "x" })).rejects.toBeInstanceOf(GlossaryTermNotFoundError);
    await expect(deleteGlossaryTerm(admin.id, "nonexistent-id")).rejects.toBeInstanceOf(GlossaryTermNotFoundError);
  });
});

describe("glossary.service — expandQuery", () => {
  it("appends the canonical term for a matching glossary entry", async () => {
    sequence += 1;
    const admin = await makeAdmin([{ module: "Products", action: "Edit" }]);
    const term = `${TERM_PREFIX}${sequence}`;
    await createGlossaryTerm(admin.id, { term, canonicalTerm: "chilli powder", targetType: null, targetId: null });

    const expanded = await expandQuery(`buy ${term} online`);
    expect(expanded).toContain("chilli powder");
  });

  it("returns the original query unchanged when nothing matches", async () => {
    const expanded = await expandQuery("a query that matches nothing seeded");
    expect(expanded).toBe("a query that matches nothing seeded");
  });
});
