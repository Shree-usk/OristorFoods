import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { AdminUserAdminError, type AdminUserAdminErrorCode } from "@/services/admin-user-admin.errors";
import { PermissionDeniedError, PermissionServiceError, type PermissionErrorCode } from "@/services/permission.errors";
import { RoleAdminError, type RoleAdminErrorCode } from "@/services/role-admin.errors";

const adminUserStatusByCode: Record<AdminUserAdminErrorCode, number> = {
  not_found: 404,
  email_in_use: 409,
  invalid_invite_token: 400,
  invite_token_expired: 410,
};

const permissionStatusByCode: Record<PermissionErrorCode, number> = {
  permission_denied: 403,
  super_administrator_floor: 409,
  last_super_administrator: 409,
};

const roleStatusByCode: Record<RoleAdminErrorCode, number> = {
  not_found: 404,
  key_in_use: 409,
};

export function adminUserAdminErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof PermissionServiceError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: permissionStatusByCode[error.code] });
  }
  if (error instanceof AdminUserAdminError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: adminUserStatusByCode[error.code] });
  }
  if (error instanceof RoleAdminError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: roleStatusByCode[error.code] });
  }
  return serverErrorResponse(error, context);
}
