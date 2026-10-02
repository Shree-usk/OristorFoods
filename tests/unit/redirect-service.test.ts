// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { PermissionDeniedError } from "@/services/permission.errors";
import { RedirectConflictError, RedirectNotFoundError, RedirectSourcePathTakenError } from "@/services/redirect.errors";
import {
  bulkImportRedirects,
  createRedirect,
  deleteRedirect,
  detectRedirectConflict,
  getRedirectAdminDetail,
  listRedirectsForAdmin,
  updateRedirect,
} from "@/services/redirect.service";

const EMAIL_DOMAIN = "@redirect-svc-test.test";
const ROLE_KEY_PREFIX = "redirect-svc-test-role-";
const PATH_PREFIX = "/redirect-svc-test-";
let sequence = 0;

async function makeRole(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Redirect Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return role;
}

async function makeAdminUser(roleId: string) {
  sequence += 1;
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId } });
}

async function makeFullAccessAdmin() {
  const role = await makeRole([
    { module: "SEO", action: "View" },
    { module: "SEO", action: "Edit" },
  ]);
  return makeAdminUser(role.id);
}

async function makeViewOnlyAdmin() {
  const role = await makeRole([{ module: "SEO", action: "View" }]);
  return makeAdminUser(role.id);
}

function path(name: string) {
  return `${PATH_PREFIX}${name}-${sequence}`;
}

afterEach(async () => {
  await prisma.redirect.deleteMany({ where: { sourcePath: { startsWith: PATH_PREFIX } } });
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("redirect.service — admin CRUD", () => {
  it("creates, updates, deletes, and audit-logs each", async () => {
    const admin = await makeFullAccessAdmin();
    sequence += 1;
    const source = path("a");
    const dest = path("b");

    const created = await createRedirect(admin.id, { sourcePath: source, destinationPath: dest, statusCode: 301, active: true });
    expect(created.statusCode).toBe(301);

    const updated = await updateRedirect(admin.id, created.id, { statusCode: 302 });
    expect(updated.statusCode).toBe(302);

    const detail = await getRedirectAdminDetail(admin.id, created.id);
    expect(detail.id).toBe(created.id);

    const list = await listRedirectsForAdmin(admin.id);
    expect(list.some((r) => r.id === created.id)).toBe(true);

    await deleteRedirect(admin.id, created.id);
    await expect(getRedirectAdminDetail(admin.id, created.id)).rejects.toBeInstanceOf(RedirectNotFoundError);

    const createdLog = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "redirect_created", targetId: created.id } });
    const updatedLog = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "redirect_updated", targetId: created.id } });
    const deletedLog = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "redirect_deleted", targetId: created.id } });
    expect(createdLog).not.toBeNull();
    expect(updatedLog).not.toBeNull();
    expect(deletedLog).not.toBeNull();
  });

  it("rejects a View-only admin's write but allows the read", async () => {
    const viewer = await makeViewOnlyAdmin();
    sequence += 1;
    await expect(createRedirect(viewer.id, { sourcePath: path("c"), destinationPath: path("d"), statusCode: 301, active: true })).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(listRedirectsForAdmin(viewer.id)).resolves.toEqual([]);
  });

  it("rejects a duplicate source path with a typed error, not a raw Prisma error", async () => {
    const admin = await makeFullAccessAdmin();
    sequence += 1;
    const source = path("dup");
    await createRedirect(admin.id, { sourcePath: source, destinationPath: path("x"), statusCode: 301, active: true });
    await expect(createRedirect(admin.id, { sourcePath: source, destinationPath: path("y"), statusCode: 301, active: true })).rejects.toBeInstanceOf(RedirectSourcePathTakenError);
  });

  it("rejects a self-loop and a chain against a real existing redirect", async () => {
    const admin = await makeFullAccessAdmin();
    sequence += 1;
    const a = path("chain-a");
    const b = path("chain-b");
    await createRedirect(admin.id, { sourcePath: a, destinationPath: b, statusCode: 301, active: true });

    await expect(createRedirect(admin.id, { sourcePath: path("self"), destinationPath: path("self"), statusCode: 301, active: true }).catch((e) => e)).resolves.toBeInstanceOf(RedirectConflictError);
    // Pointing at something that itself already redirects elsewhere (a) — a chain.
    await expect(createRedirect(admin.id, { sourcePath: path("new"), destinationPath: a, statusCode: 301, active: true })).rejects.toBeInstanceOf(RedirectConflictError);
    // Redirecting the thing another redirect already points at (b) further — also a chain.
    await expect(createRedirect(admin.id, { sourcePath: b, destinationPath: path("elsewhere"), statusCode: 301, active: true })).rejects.toBeInstanceOf(RedirectConflictError);
  });
});

describe("detectRedirectConflict", () => {
  it("rejects a self-loop", () => {
    const error = detectRedirectConflict({ sourcePath: "/a", destinationPath: "/a" }, []);
    expect(error?.reason).toBe("self_loop");
  });

  it("rejects pointing at an existing redirect's source (chain)", () => {
    const error = detectRedirectConflict({ sourcePath: "/new", destinationPath: "/old" }, [{ sourcePath: "/old", destinationPath: "/final" }]);
    expect(error?.reason).toBe("chain");
  });

  it("rejects redirecting a path another redirect already points at (chain)", () => {
    const error = detectRedirectConflict({ sourcePath: "/mid", destinationPath: "/further" }, [{ sourcePath: "/start", destinationPath: "/mid" }]);
    expect(error?.reason).toBe("chain");
  });

  it("accepts a clean, unrelated redirect", () => {
    const error = detectRedirectConflict({ sourcePath: "/new", destinationPath: "/target" }, [{ sourcePath: "/other", destinationPath: "/other-target" }]);
    expect(error).toBeNull();
  });
});

describe("redirect.service — bulkImportRedirects", () => {
  it("creates valid rows, rejects a duplicate within the batch, a row chaining against an existing DB redirect, and a malformed line", async () => {
    const admin = await makeFullAccessAdmin();
    sequence += 1;
    const existingSource = path("existing");
    const existingDest = path("existing-dest");
    await createRedirect(admin.id, { sourcePath: existingSource, destinationPath: existingDest, statusCode: 301, active: true });

    const ok1 = path("ok1");
    const ok1dest = path("ok1-dest");
    const dupSource = path("dup-batch");
    const dupDest = path("dup-batch-dest");
    const chainSource = path("chains-into-existing");

    const csv = [
      "sourcePath,destinationPath,statusCode",
      `${ok1},${ok1dest},301`,
      `${dupSource},${dupDest},301`,
      `${dupSource},${dupDest}-again,301`, // duplicate sourcePath within the same batch
      `${chainSource},${existingSource},301`, // chains into the existing redirect's source
      "not-a-path,/somewhere,301", // malformed: source doesn't start with "/"
    ].join("\n");

    const result = await bulkImportRedirects(admin.id, csv);

    expect(result.succeeded.map((r) => r.sourcePath)).toEqual([ok1, dupSource]);
    expect(result.failed).toHaveLength(3);
    expect(result.failed.find((r) => r.sourcePath === dupSource && r.line === 4)).toBeTruthy();
    expect(result.failed.find((r) => r.sourcePath === chainSource)).toBeTruthy();
    expect(result.failed.find((r) => r.sourcePath === "not-a-path")).toBeTruthy();

    const rows = await prisma.redirect.findMany({ where: { sourcePath: { in: [ok1, dupSource, chainSource] } } });
    expect(rows.map((r) => r.sourcePath).sort()).toEqual([dupSource, ok1].sort());
  });
});
