import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import * as adminUserRepository from "@/repositories/admin-user.repository";
import * as roleRepository from "@/repositories/role.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { LastSuperAdministratorError, PermissionDeniedError, SuperAdministratorFloorError } from "@/services/permission.errors";

/** Stable Role.key — see prisma/schema.prisma's comment on why this is separate from the editable display name. */
export const SUPER_ADMINISTRATOR_ROLE_KEY = "super_administrator";

function permissionKey(module: AdminModule, action: AdminAction): string {
  return `${module}:${action}`;
}

/**
 * Always a fresh DB read — never trusts anything cached in the admin JWT —
 * so a permission change (via STORY-057's future role-editing UI) takes
 * effect immediately without a redeploy, per the AC.
 */
export async function getPermissionsForAdminUser(adminUserId: string): Promise<Set<string>> {
  const adminUser = await adminUserRepository.findById(adminUserId);
  if (!adminUser) return new Set();

  const rows = await roleRepository.findPermissionsForRole(adminUser.roleId);
  return new Set(rows.map((row) => permissionKey(row.module, row.action)));
}

export async function hasPermission(adminUserId: string, module: AdminModule, action: AdminAction): Promise<boolean> {
  const permissions = await getPermissionsForAdminUser(adminUserId);
  return permissions.has(permissionKey(module, action));
}

/**
 * The shared guard every protected admin Service/route call makes — the
 * real security boundary (AC: "hiding a UI button/route redirect is never
 * treated as access control"). Writes a "permission_denied" audit-log
 * entry on rejection, per the AC.
 */
export async function requirePermission(adminUserId: string, module: AdminModule, action: AdminAction): Promise<void> {
  const granted = await hasPermission(adminUserId, module, action);
  if (granted) return;

  await writeAuditLog({ actorId: adminUserId, action: "permission_denied", module, metadata: { attemptedAction: action } });
  throw new PermissionDeniedError();
}

/**
 * The Super Administrator role's matrix can never be reduced below full
 * access (AC). No caller exists yet — STORY-057 owns the role-editing UI
 * this guards — built and unit-tested now so that story can call it
 * directly rather than reimplementing the rule.
 */
export function assertCanModifyRolePermission(roleKey: string, granting: boolean): void {
  if (roleKey === SUPER_ADMINISTRATOR_ROLE_KEY && !granting) throw new SuperAdministratorFloorError();
}

/**
 * Prevents deleting or de-elevating the last remaining Super Administrator
 * account (AC). A no-op for any admin who doesn't currently hold that
 * role. No caller exists yet for the same reason as above.
 */
export async function assertNotLastSuperAdmin(adminUserId: string): Promise<void> {
  const adminUser = await adminUserRepository.findById(adminUserId);
  if (!adminUser || adminUser.role.key !== SUPER_ADMINISTRATOR_ROLE_KEY) return;

  const count = await adminUserRepository.countByRoleId(adminUser.roleId);
  if (count <= 1) throw new LastSuperAdministratorError();
}
