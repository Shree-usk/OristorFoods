"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchRoles } from "@/lib/api/admin-roles-client";
import {
  deleteUser,
  fetchUsers,
  inviteAdminUser,
  reactivateUser,
  resendInvite,
  suspendUser,
  unlockUser,
  updateUserRole,
  type AdminUserListItem,
} from "@/lib/api/admin-users-client";

const EMPTY_INVITE = { email: "", name: "", roleId: "" };

/**
 * STORY-057. Mirrors admin-customer-detail-view.tsx's runAction()
 * error-handling idiom and admin-coupons-panel.tsx's Dialog-driven-by-
 * local-state idiom for the invite form.
 */
export function AdminUsersView() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState(EMPTY_INVITE);
  const [editRoleUser, setEditRoleUser] = useState<AdminUserListItem | null>(null);
  const [editRoleId, setEditRoleId] = useState("");
  const [deleteUserTarget, setDeleteUserTarget] = useState<AdminUserListItem | null>(null);

  const { data: users } = useQuery({ queryKey: ["admin-users"], queryFn: fetchUsers });
  const { data: roles } = useQuery({ queryKey: ["admin-roles-picker"], queryFn: fetchRoles });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  }

  async function runAction(fn: () => Promise<unknown>) {
    setActionError(null);
    try {
      await fn();
      invalidate();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Action failed.");
    }
  }

  async function handleInvite() {
    await runAction(async () => {
      await inviteAdminUser(inviteForm);
      setInviteForm(EMPTY_INVITE);
      setInviteOpen(false);
    });
  }

  async function handleUpdateRole() {
    if (!editRoleUser) return;
    await runAction(async () => {
      await updateUserRole(editRoleUser.id, editRoleId);
      setEditRoleUser(null);
    });
  }

  async function handleDelete() {
    if (!deleteUserTarget) return;
    await runAction(async () => {
      await deleteUser(deleteUserTarget.id);
      setDeleteUserTarget(null);
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-h2 font-heading text-charcoal">Admin Users</h1>
        <Button type="button" onClick={() => setInviteOpen(true)}>
          Invite admin
        </Button>
      </div>

      {actionError && <p className="mt-3 text-small text-destructive">{actionError}</p>}

      <Table className="mt-6">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last login</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {(users ?? []).map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.name}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.role.name}</TableCell>
              <TableCell>
                <Badge variant={user.status === "Active" ? "default" : user.status === "Deactivated" ? "destructive" : "outline"}>{user.status}</Badge>
              </TableCell>
              <TableCell>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditRoleUser(user);
                      setEditRoleId(user.role.id);
                    }}
                  >
                    Edit role
                  </Button>
                  {user.status === "Invited" && (
                    <Button size="sm" variant="outline" onClick={() => runAction(() => resendInvite(user.id))}>
                      Resend invite
                    </Button>
                  )}
                  {user.status === "Locked" && (
                    <Button size="sm" variant="outline" onClick={() => runAction(() => unlockUser(user.id))}>
                      Unlock
                    </Button>
                  )}
                  {user.status === "Deactivated" ? (
                    <Button size="sm" variant="outline" onClick={() => runAction(() => reactivateUser(user.id))}>
                      Reactivate
                    </Button>
                  ) : (
                    user.status === "Active" && (
                      <Button size="sm" variant="outline" onClick={() => runAction(() => suspendUser(user.id))}>
                        Suspend
                      </Button>
                    )
                  )}
                  <Button size="sm" variant="destructive" onClick={() => setDeleteUserTarget(user)}>
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <h2 className="text-h4 font-heading text-charcoal">Invite admin</h2>

          <Label htmlFor="invite-name" className="mt-3 block">
            Name
          </Label>
          <Input id="invite-name" value={inviteForm.name} onChange={(event) => setInviteForm((prev) => ({ ...prev, name: event.target.value }))} />

          <Label htmlFor="invite-email" className="mt-3 block">
            Email
          </Label>
          <Input id="invite-email" type="email" value={inviteForm.email} onChange={(event) => setInviteForm((prev) => ({ ...prev, email: event.target.value }))} />

          <Label htmlFor="invite-role" className="mt-3 block">
            Role
          </Label>
          <Select value={inviteForm.roleId} onValueChange={(value) => setInviteForm((prev) => ({ ...prev, roleId: value ?? "" }))}>
            <SelectTrigger id="invite-role" className="w-full">
              <SelectValue>{(selected: string | null) => roles?.find((role) => role.id === selected)?.name ?? "Choose a role"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(roles ?? []).map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button type="button" className="mt-4 w-fit" onClick={handleInvite} disabled={!inviteForm.name.trim() || !inviteForm.email.trim() || !inviteForm.roleId}>
            Send invite
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={editRoleUser !== null} onOpenChange={(open) => !open && setEditRoleUser(null)}>
        <DialogContent>
          <h2 className="text-h4 font-heading text-charcoal">Edit role — {editRoleUser?.name}</h2>

          <Label htmlFor="edit-role" className="mt-3 block">
            Role
          </Label>
          <Select value={editRoleId} onValueChange={(value) => setEditRoleId(value ?? "")}>
            <SelectTrigger id="edit-role" className="w-full">
              <SelectValue>{(selected: string | null) => roles?.find((role) => role.id === selected)?.name ?? "Choose a role"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(roles ?? []).map((role) => (
                <SelectItem key={role.id} value={role.id}>
                  {role.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button type="button" className="mt-4 w-fit" onClick={handleUpdateRole} disabled={!editRoleId}>
            Save
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteUserTarget !== null} onOpenChange={(open) => !open && setDeleteUserTarget(null)}>
        <DialogContent>
          <h2 className="text-h4 font-heading text-charcoal">Delete {deleteUserTarget?.name}?</h2>
          <p className="mt-2 text-small text-charcoal/70">This permanently removes their admin account. This cannot be undone.</p>
          <Button type="button" variant="destructive" className="mt-4 w-fit" onClick={handleDelete}>
            Delete account
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
