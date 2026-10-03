import { createHash, randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";

import { checkRateLimit } from "@/lib/rate-limit";
import * as adminInviteRepository from "@/repositories/admin-invite.repository";
import * as adminUserRepository from "@/repositories/admin-user.repository";
import { AdminEmailInUseError, AdminUserNotFoundError, InvalidInviteTokenError, InviteTokenExpiredError } from "@/services/admin-user-admin.errors";
import { writeAuditLog } from "@/services/audit-log.service";
import { sendTransactionalEmail } from "@/services/notification.service";
import { SUPER_ADMINISTRATOR_ROLE_KEY, assertNotLastSuperAdmin, requirePermission } from "@/services/permission.service";

/**
 * STORY-057. Admin Users console — permission-gated (UsersRolesAudit,
 * View/Edit/Delete) and audit-logged. The invite flow mirrors
 * auth.service.ts's proven password-reset pattern exactly (hashed
 * token in the repurposed VerificationToken table via
 * admin-invite.repository.ts, 1-hour TTL, rate-limited).
 */

const INVITE_TOKEN_TTL_MS = 60 * 60 * 1000;
const INVITE_RATE_LIMIT = { max: 3, windowMs: 60 * 60 * 1000 };

function hashInviteToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

async function issueInviteToken(email: string, name: string): Promise<void> {
  const rawToken = randomBytes(32).toString("hex");
  await adminInviteRepository.deleteAllForEmail(email);
  await adminInviteRepository.create({ email, token: hashInviteToken(rawToken), expires: new Date(Date.now() + INVITE_TOKEN_TTL_MS) });

  // Deliberately outside the (admin) route group — src/app/(admin)/layout.tsx
  // redirects to /admin/login for anyone with no session, which an
  // invited admin doesn't have yet (same reasoning as /admin/login itself).
  const acceptUrl = new URL("/admin/accept-invite", process.env.NEXT_PUBLIC_SITE_URL ?? "https://oristor.com");
  acceptUrl.searchParams.set("token", rawToken);
  acceptUrl.searchParams.set("email", email);

  await sendTransactionalEmail(
    email,
    "You've been invited to the Oristor Admin Console",
    `Hi ${name},\n\nYou've been invited to join the Oristor Admin Console. This link expires in 1 hour:\n\n${acceptUrl.toString()}\n\nIf you weren't expecting this invite, you can safely ignore this email.`,
  );
}

export async function listUsersForAdmin(adminUserId: string) {
  await requirePermission(adminUserId, "UsersRolesAudit", "View");
  const [users, lastLogins] = await Promise.all([adminUserRepository.listAll(), adminUserRepository.listLastLoginTimestamps()]);
  return users.map((user) => ({ ...user, lastLoginAt: lastLogins.get(user.id) ?? null }));
}

async function requireUser(id: string) {
  const user = await adminUserRepository.findById(id);
  if (!user) throw new AdminUserNotFoundError();
  return user;
}

export async function getUserDetail(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "UsersRolesAudit", "View");
  return requireUser(id);
}

export interface InviteAdminUserInput {
  email: string;
  name: string;
  roleId: string;
}

export async function inviteAdminUser(adminUserId: string, input: InviteAdminUserInput) {
  await requirePermission(adminUserId, "UsersRolesAudit", "Edit");
  const existing = await adminUserRepository.findByEmail(input.email);
  if (existing) throw new AdminEmailInUseError();

  const placeholderHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
  const user = await adminUserRepository.create({ email: input.email, name: input.name, passwordHash: placeholderHash, roleId: input.roleId });
  const invited = await adminUserRepository.updateStatus(user.id, "Invited");

  await issueInviteToken(input.email, input.name);
  await writeAuditLog({ actorId: adminUserId, action: "admin_user_invited", module: "UsersRolesAudit", targetType: "AdminUser", targetId: user.id, metadata: { email: input.email, roleId: input.roleId } });
  return invited;
}

export async function resendInvite(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "UsersRolesAudit", "Edit");
  const user = await requireUser(id);
  if (user.status !== "Invited") throw new InvalidInviteTokenError();
  if (!checkRateLimit(`admin-invite:${user.email.toLowerCase()}`, INVITE_RATE_LIMIT)) return;

  await issueInviteToken(user.email, user.name);
  await writeAuditLog({ actorId: adminUserId, action: "admin_invite_resent", module: "UsersRolesAudit", targetType: "AdminUser", targetId: id });
}

/**
 * Runs unauthenticated — the invited admin has no session yet. Always
 * resolves the same way for every rejection path (expired token,
 * already-accepted, wrong email) as "invalid or expired", matching
 * auth.service.ts::resetPassword's no-enumeration-style handling of
 * its own token flow.
 */
export async function acceptInvite(email: string, rawToken: string, name: string, password: string): Promise<void> {
  const tokenHash = hashInviteToken(rawToken);
  const record = await adminInviteRepository.findByEmailAndToken(email, tokenHash);
  if (!record) throw new InvalidInviteTokenError();

  if (record.expires < new Date()) {
    await adminInviteRepository.deleteAllForEmail(email);
    throw new InviteTokenExpiredError();
  }

  const user = await adminUserRepository.findByEmail(email);
  if (!user || user.status !== "Invited") throw new InvalidInviteTokenError();

  const passwordHash = await bcrypt.hash(password, 10);
  await adminUserRepository.update(user.id, { name });
  await adminUserRepository.updatePassword(user.id, passwordHash);
  await adminUserRepository.updateStatus(user.id, "Active");
  await adminInviteRepository.deleteAllForEmail(email);
  await writeAuditLog({ actorId: user.id, action: "admin_invite_accepted", module: "UsersRolesAudit", targetType: "AdminUser", targetId: user.id });
}

export async function updateRole(adminUserId: string, id: string, roleId: string) {
  await requirePermission(adminUserId, "UsersRolesAudit", "Edit");
  const target = await requireUser(id);

  if (target.role.key === SUPER_ADMINISTRATOR_ROLE_KEY && target.roleId !== roleId) {
    await assertNotLastSuperAdmin(id);
  }

  const updated = await adminUserRepository.update(id, { roleId });
  await adminUserRepository.bumpSessionVersion(id);
  await writeAuditLog({ actorId: adminUserId, action: "admin_user_role_changed", module: "UsersRolesAudit", targetType: "AdminUser", targetId: id, metadata: { from: target.roleId, to: roleId } });
  return updated;
}

export async function suspendUser(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "UsersRolesAudit", "Edit");
  await requireUser(id);
  await assertNotLastSuperAdmin(id);

  const updated = await adminUserRepository.updateStatus(id, "Deactivated");
  await adminUserRepository.bumpSessionVersion(id);
  await writeAuditLog({ actorId: adminUserId, action: "admin_user_suspended", module: "UsersRolesAudit", targetType: "AdminUser", targetId: id });
  return updated;
}

export async function reactivateUser(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "UsersRolesAudit", "Edit");
  await requireUser(id);

  const updated = await adminUserRepository.updateStatus(id, "Active");
  await writeAuditLog({ actorId: adminUserId, action: "admin_user_reactivated", module: "UsersRolesAudit", targetType: "AdminUser", targetId: id });
  return updated;
}

export async function unlockUser(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "UsersRolesAudit", "Edit");
  await requireUser(id);

  const updated = await adminUserRepository.resetFailedLoginAttempts(id);
  await writeAuditLog({ actorId: adminUserId, action: "admin_user_unlocked", module: "UsersRolesAudit", targetType: "AdminUser", targetId: id });
  return updated;
}

export async function deleteUser(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "UsersRolesAudit", "Delete");
  await requireUser(id);
  await assertNotLastSuperAdmin(id);

  await adminUserRepository.deleteAdminUser(id);
  await writeAuditLog({ actorId: adminUserId, action: "admin_user_deleted", module: "UsersRolesAudit", targetType: "AdminUser", targetId: id });
}
