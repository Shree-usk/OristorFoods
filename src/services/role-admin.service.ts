import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import * as roleRepository from "@/repositories/role.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { assertCanModifyRolePermission, requirePermission } from "@/services/permission.service";
import { RoleKeyInUseError, RoleNotFoundError } from "@/services/role-admin.errors";

/**
 * STORY-057. Role management — permission-gated (UsersRolesAudit,
 * View/Edit) and audit-logged. The Super-Administrator-floor guard
 * (permission.service.ts::assertCanModifyRolePermission) was built by
 * STORY-038 specifically for this service to call.
 */

export async function listRolesWithPermissions(adminUserId: string) {
  await requirePermission(adminUserId, "UsersRolesAudit", "View");
  const roles = await roleRepository.listAll();
  const permissions = await Promise.all(roles.map((role) => roleRepository.findPermissionsForRole(role.id)));
  return roles.map((role, index) => ({ ...role, permissions: permissions[index] }));
}

export interface PermissionEntry {
  module: AdminModule;
  action: AdminAction;
  granted: boolean;
}

async function requireRole(roleId: string) {
  const role = await roleRepository.findById(roleId);
  if (!role) throw new RoleNotFoundError();
  return role;
}

/** `entries` represents the role's entire desired matrix state (every module x action cell), not a sparse diff. */
export async function updateRolePermissions(adminUserId: string, roleId: string, entries: PermissionEntry[]) {
  await requirePermission(adminUserId, "UsersRolesAudit", "Edit");
  const role = await requireRole(roleId);

  for (const entry of entries) {
    if (!entry.granted) assertCanModifyRolePermission(role.key, false);
  }

  const grantedEntries = entries.filter((entry) => entry.granted).map((entry) => ({ module: entry.module, action: entry.action }));
  await roleRepository.replacePermissions(roleId, grantedEntries);
  await writeAuditLog({ actorId: adminUserId, action: "role_permissions_updated", module: "UsersRolesAudit", targetType: "Role", targetId: roleId, metadata: { grantedCount: grantedEntries.length } });
  return roleRepository.findPermissionsForRole(roleId);
}

export interface CloneRoleInput {
  sourceRoleId: string;
  newKey: string;
  newName: string;
}

export async function cloneRole(adminUserId: string, input: CloneRoleInput) {
  await requirePermission(adminUserId, "UsersRolesAudit", "Edit");
  await requireRole(input.sourceRoleId);

  const existingKey = await roleRepository.findByKey(input.newKey);
  if (existingKey) throw new RoleKeyInUseError();

  const newRole = await roleRepository.create(input.newKey, input.newName);
  await roleRepository.copyPermissions(input.sourceRoleId, newRole.id);
  await writeAuditLog({ actorId: adminUserId, action: "role_cloned", module: "UsersRolesAudit", targetType: "Role", targetId: newRole.id, metadata: { sourceRoleId: input.sourceRoleId } });
  return newRole;
}
