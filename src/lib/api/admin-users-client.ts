/** STORY-057. Fetch wrappers for /api/admin/users/*. */

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export type AdminUserStatusValue = "Active" | "Locked" | "Deactivated" | "Invited";

export interface AdminUserRole {
  id: string;
  key: string;
  name: string;
}

export interface AdminUserListItem {
  id: string;
  email: string;
  name: string;
  status: AdminUserStatusValue;
  role: AdminUserRole;
  lockedUntil: string | null;
  lastLoginAt: string | null;
}

export async function fetchUsers(): Promise<AdminUserListItem[]> {
  const response = await fetch("/api/admin/users");
  if (!response.ok) throw new Error(`Failed to load admin users (${response.status})`);
  return response.json();
}

export interface InviteAdminUserInput {
  email: string;
  name: string;
  roleId: string;
}

export async function inviteAdminUser(input: InviteAdminUserInput): Promise<AdminUserListItem> {
  const response = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to invite the admin user");
  return response.json();
}

export async function updateUserRole(id: string, roleId: string): Promise<AdminUserListItem> {
  const response = await fetch(`/api/admin/users/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roleId }) });
  await assertOkWithServerMessage(response, "Failed to update the user's role");
  return response.json();
}

export async function deleteUser(id: string): Promise<void> {
  const response = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
  await assertOkWithServerMessage(response, "Failed to delete the user");
}

async function postAction(id: string, action: "suspend" | "reactivate" | "unlock" | "resend-invite"): Promise<void> {
  const response = await fetch(`/api/admin/users/${id}/${action}`, { method: "POST" });
  await assertOkWithServerMessage(response, `Failed to ${action.replace("-", " ")} the user`);
}

export const suspendUser = (id: string) => postAction(id, "suspend");
export const reactivateUser = (id: string) => postAction(id, "reactivate");
export const unlockUser = (id: string) => postAction(id, "unlock");
export const resendInvite = (id: string) => postAction(id, "resend-invite");

export async function acceptInvite(input: { email: string; token: string; name: string; password: string }): Promise<void> {
  const response = await fetch("/api/admin/users/accept-invite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  await assertOkWithServerMessage(response, "Failed to accept the invite");
}
