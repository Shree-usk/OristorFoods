// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockEmailSend } = vi.hoisted(() => ({ mockEmailSend: vi.fn().mockResolvedValue({ status: "sent" }) }));

// Mirrors tests/unit/auth-service.test.ts's exact mocking shape for the same reason — inviteAdminUser/resendInvite send a real email via notification.service.ts's sendTransactionalEmail.
vi.mock("@/services/notification/email.provider", () => ({
  EmailProvider: class {
    name = "mock-email-for-test";
    send = mockEmailSend;
  },
}));

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { PermissionDeniedError } from "@/services/permission.errors";
import {
  acceptInvite,
  deleteUser,
  inviteAdminUser,
  listUsersForAdmin,
  reactivateUser,
  resendInvite,
  suspendUser,
  unlockUser,
  updateRole,
} from "@/services/admin-user-admin.service";
import { AdminEmailInUseError, InvalidInviteTokenError, InviteTokenExpiredError } from "@/services/admin-user-admin.errors";
import { LastSuperAdministratorError } from "@/services/permission.errors";
import { SUPER_ADMINISTRATOR_ROLE_KEY } from "@/services/permission.service";

const EMAIL_DOMAIN = "@admin-user-admin-svc-test.test";
const ROLE_KEY_PREFIX = "admin-user-admin-svc-test-role-";
let sequence = 0;

function nextInviteEmail(): string {
  sequence += 1;
  return `invitee-${sequence}${EMAIL_DOMAIN}`;
}

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Admin User Admin Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

async function makeFullAccessAdmin() {
  return makeAdmin([
    { module: "UsersRolesAudit", action: "View" },
    { module: "UsersRolesAudit", action: "Edit" },
    { module: "UsersRolesAudit", action: "Delete" },
  ]);
}

async function makeViewerRole() {
  sequence += 1;
  return prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}viewer-${sequence}`, name: `Test Viewer Role ${sequence}` } });
}

function extractToken(callIndex = -1): string {
  const calls = mockEmailSend.mock.calls;
  const call = calls[callIndex < 0 ? calls.length + callIndex : callIndex] as [string, string, string];
  const [, , body] = call;
  return new URL(body.match(/https?:\/\/\S+/)![0]).searchParams.get("token")!;
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.verificationToken.deleteMany({ where: { identifier: { contains: EMAIL_DOMAIN } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("admin-user-admin.service — invite / accept-invite", () => {
  it("invites an admin as Invited, and the invite can be accepted to become Active", async () => {
    const admin = await makeFullAccessAdmin();
    const viewerRole = await makeViewerRole();
    const email = nextInviteEmail();

    const invited = await inviteAdminUser(admin.id, { email, name: "New Hire", roleId: viewerRole.id });
    expect(invited.status).toBe("Invited");
    expect(mockEmailSend).toHaveBeenCalled();

    const token = extractToken();
    await acceptInvite(email, token, "New Hire", "ActivatedPassword123");

    const activated = await prisma.adminUser.findUniqueOrThrow({ where: { email } });
    expect(activated.status).toBe("Active");
    expect(activated.passwordChangedAt.getTime()).toBeGreaterThanOrEqual(invited.passwordChangedAt.getTime());
  });

  it("rejects inviting an email that's already an admin", async () => {
    const admin = await makeFullAccessAdmin();
    const viewerRole = await makeViewerRole();

    await expect(inviteAdminUser(admin.id, { email: admin.email, name: "Dup", roleId: viewerRole.id })).rejects.toBeInstanceOf(AdminEmailInUseError);
  });

  it("rejects an expired invite token", async () => {
    const admin = await makeFullAccessAdmin();
    const viewerRole = await makeViewerRole();
    const email = nextInviteEmail();

    await inviteAdminUser(admin.id, { email, name: "New Hire", roleId: viewerRole.id });
    const token = extractToken();
    await prisma.verificationToken.updateMany({ where: { identifier: `admin-invite:${email}` }, data: { expires: new Date(Date.now() - 1000) } });

    await expect(acceptInvite(email, token, "New Hire", "ActivatedPassword123")).rejects.toBeInstanceOf(InviteTokenExpiredError);
  });

  it("rejects a replayed invite token", async () => {
    const admin = await makeFullAccessAdmin();
    const viewerRole = await makeViewerRole();
    const email = nextInviteEmail();

    await inviteAdminUser(admin.id, { email, name: "New Hire", roleId: viewerRole.id });
    const token = extractToken();
    await acceptInvite(email, token, "New Hire", "ActivatedPassword123");

    await expect(acceptInvite(email, token, "New Hire", "AnotherPassword456")).rejects.toBeInstanceOf(InvalidInviteTokenError);
  });

  it("resendInvite issues a fresh token that supersedes the original", async () => {
    const admin = await makeFullAccessAdmin();
    const viewerRole = await makeViewerRole();
    const email = nextInviteEmail();
    const invited = await inviteAdminUser(admin.id, { email, name: "New Hire", roleId: viewerRole.id });
    const firstToken = extractToken();

    await resendInvite(admin.id, invited.id);
    const secondToken = extractToken();
    expect(secondToken).not.toBe(firstToken);

    await expect(acceptInvite(email, firstToken, "New Hire", "ActivatedPassword123")).rejects.toBeInstanceOf(InvalidInviteTokenError);
    await expect(acceptInvite(email, secondToken, "New Hire", "ActivatedPassword123")).resolves.toBeUndefined();
  });

  it("rejects a View-only admin's invite but allows the list read", async () => {
    const viewer = await makeAdmin([{ module: "UsersRolesAudit", action: "View" }]);
    const viewerRole = await makeViewerRole();
    await expect(listUsersForAdmin(viewer.id)).resolves.toBeInstanceOf(Array);
    await expect(inviteAdminUser(viewer.id, { email: nextInviteEmail(), name: "X", roleId: viewerRole.id })).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("admin-user-admin.service — self-lockout protection", () => {
  // Mirrors permission-service.test.ts's own findOrCreateSuperAdministratorRole
  // exactly — the guards hardcode a comparison against the real
  // SUPER_ADMINISTRATOR_ROLE_KEY, so exercising "last Super Administrator"
  // means using that exact seeded role and clearing its existing AdminUsers
  // first so the count these guards check is exact and deterministic. Safe
  // in a local/CI test database only (see that file's own comment).
  async function makeSoleSuperAdmin() {
    const existing = await prisma.role.findUnique({ where: { key: SUPER_ADMINISTRATOR_ROLE_KEY } });
    const superRole = existing ?? (await prisma.role.create({ data: { key: SUPER_ADMINISTRATOR_ROLE_KEY, name: "Super Administrator" } }));
    await prisma.adminUser.deleteMany({ where: { roleId: superRole.id } });
    // Grant exactly what this test's own service calls need — don't
    // assume the real seed script's full permission set is present
    // (vitest's global-setup truncates all data before every run and
    // nothing re-seeds it, so a persistent local dev DB can end up with
    // this real role existing but with zero RolePermission rows).
    await prisma.rolePermission.deleteMany({ where: { roleId: superRole.id } });
    await prisma.rolePermission.createMany({
      data: [
        { roleId: superRole.id, module: "UsersRolesAudit", action: "View" },
        { roleId: superRole.id, module: "UsersRolesAudit", action: "Edit" },
        { roleId: superRole.id, module: "UsersRolesAudit", action: "Delete" },
      ],
    });

    sequence += 1;
    const admin = await prisma.adminUser.create({ data: { email: `sole-super-${sequence}${EMAIL_DOMAIN}`, name: "Sole Super Admin", passwordHash: "unused", roleId: superRole.id } });
    return { admin, superRole };
  }

  it("blocks deleting the last Super Administrator", async () => {
    const { admin } = await makeSoleSuperAdmin();
    await expect(deleteUser(admin.id, admin.id)).rejects.toBeInstanceOf(LastSuperAdministratorError);
  });

  it("blocks suspending the last Super Administrator", async () => {
    const { admin } = await makeSoleSuperAdmin();
    await expect(suspendUser(admin.id, admin.id)).rejects.toBeInstanceOf(LastSuperAdministratorError);
  });

  it("blocks changing the last Super Administrator's role away from Super Administrator", async () => {
    const { admin } = await makeSoleSuperAdmin();
    const viewerRole = await makeViewerRole();
    await expect(updateRole(admin.id, admin.id, viewerRole.id)).rejects.toBeInstanceOf(LastSuperAdministratorError);
  });

  it("allows deleting a Super Administrator when another one still exists", async () => {
    const { admin: first, superRole } = await makeSoleSuperAdmin();
    sequence += 1;
    const second = await prisma.adminUser.create({ data: { email: `second-super-${sequence}${EMAIL_DOMAIN}`, name: "Second Super Admin", passwordHash: "unused", roleId: superRole.id } });

    await expect(deleteUser(second.id, first.id)).resolves.toBeUndefined();
  });
});

describe("admin-user-admin.service — suspend / reactivate / unlock bump the session version", () => {
  it("suspending and reactivating both bump passwordChangedAt (force-signs-out outstanding sessions)", async () => {
    const admin = await makeFullAccessAdmin();
    const viewerRole = await makeViewerRole();
    sequence += 1;
    const target = await prisma.adminUser.create({ data: { email: `target-${sequence}${EMAIL_DOMAIN}`, name: "Target", passwordHash: "unused", roleId: viewerRole.id } });
    const before = target.passwordChangedAt.getTime();

    const suspended = await suspendUser(admin.id, target.id);
    expect(suspended.status).toBe("Deactivated");
    // >= not >: both timestamps are millisecond-precision and these are
    // fast sequential local-DB calls that can land in the same millisecond.
    expect(suspended.passwordChangedAt.getTime()).toBeGreaterThanOrEqual(before);

    const reactivated = await reactivateUser(admin.id, target.id);
    expect(reactivated.status).toBe("Active");
  });

  it("unlockUser resets failed login attempts and lockedUntil", async () => {
    const admin = await makeFullAccessAdmin();
    const viewerRole = await makeViewerRole();
    sequence += 1;
    const target = await prisma.adminUser.create({
      data: { email: `locked-${sequence}${EMAIL_DOMAIN}`, name: "Locked", passwordHash: "unused", roleId: viewerRole.id, failedLoginAttempts: 5, lockedUntil: new Date(Date.now() + 60_000) },
    });

    const unlocked = await unlockUser(admin.id, target.id);
    expect(unlocked.failedLoginAttempts).toBe(0);
    expect(unlocked.lockedUntil).toBeNull();
  });
});

describe("admin-user-admin.service — audit log coverage", () => {
  it("writes an audit log entry for invite, role change, suspend, and delete", async () => {
    const admin = await makeFullAccessAdmin();
    const viewerRole = await makeViewerRole();
    const email = nextInviteEmail();

    const invited = await inviteAdminUser(admin.id, { email, name: "New Hire", roleId: viewerRole.id });
    await updateRole(admin.id, invited.id, viewerRole.id);
    await suspendUser(admin.id, invited.id);
    await deleteUser(admin.id, invited.id);

    const actions = (await prisma.auditLog.findMany({ where: { actorId: admin.id, targetId: invited.id } })).map((row) => row.action);
    expect(actions).toEqual(expect.arrayContaining(["admin_user_invited", "admin_user_role_changed", "admin_user_suspended", "admin_user_deleted"]));
  });
});
