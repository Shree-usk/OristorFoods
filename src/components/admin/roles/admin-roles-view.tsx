"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ADMIN_ACTIONS,
  ADMIN_MODULES,
  cloneRole,
  fetchRoles,
  updateRolePermissions,
  type AdminActionValue,
  type AdminModuleValue,
} from "@/lib/api/admin-roles-client";

const SUPER_ADMINISTRATOR_ROLE_KEY = "super_administrator";

function permissionKey(module: AdminModuleValue, action: AdminActionValue): string {
  return `${module}:${action}`;
}

/** STORY-057. A Module x Action checkbox grid, one role at a time, saved as a single full-matrix replace — mirrors coupon.repository.ts's replace-all idiom server-side. */
export function AdminRolesView() {
  const queryClient = useQueryClient();
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [grantedKeys, setGrantedKeys] = useState<Set<string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneForm, setCloneForm] = useState({ newKey: "", newName: "" });

  const { data: roles } = useQuery({ queryKey: ["admin-roles"], queryFn: fetchRoles });
  const selectedRole = roles?.find((role) => role.id === selectedRoleId) ?? null;

  if (roles && roles.length > 0 && selectedRoleId === null) {
    setSelectedRoleId(roles[0]!.id);
  }
  if (selectedRole && grantedKeys === null) {
    setGrantedKeys(new Set(selectedRole.permissions.map((row) => permissionKey(row.module, row.action))));
  }

  function selectRole(roleId: string) {
    setSelectedRoleId(roleId);
    setGrantedKeys(null);
    setSaved(false);
    setError(null);
  }

  function toggleCell(module: AdminModuleValue, action: AdminActionValue) {
    const key = permissionKey(module, action);
    setGrantedKeys((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setSaved(false);
  }

  const isSuperAdmin = selectedRole?.key === SUPER_ADMINISTRATOR_ROLE_KEY;

  async function handleSave() {
    if (!selectedRole || !grantedKeys) return;
    setError(null);
    setSaved(false);
    try {
      const entries = ADMIN_MODULES.flatMap((module) =>
        ADMIN_ACTIONS.map((action) => ({ module, action, granted: grantedKeys.has(permissionKey(module, action)) })),
      );
      await updateRolePermissions(selectedRole.id, entries);
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save the permission matrix.");
    }
  }

  async function handleClone() {
    setError(null);
    try {
      const created = await cloneRole({ sourceRoleId: selectedRole?.id ?? "", newKey: cloneForm.newKey, newName: cloneForm.newName });
      setCloneForm({ newKey: "", newName: "" });
      setCloneOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      selectRole(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clone the role.");
    }
  }

  return (
    <div>
      <h1 className="text-h2 font-heading text-charcoal">Roles</h1>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="role-picker">Role</Label>
          <Select value={selectedRoleId ?? ""} onValueChange={(value) => value && selectRole(value)}>
            <SelectTrigger id="role-picker" className="w-64">
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
        </div>
        <Button type="button" variant="outline" onClick={() => setCloneOpen(true)} disabled={!selectedRole}>
          Clone this role
        </Button>
      </div>

      {error && <p className="mt-3 text-small text-destructive">{error}</p>}
      {saved && <p className="mt-3 text-small text-charcoal/70">Saved.</p>}
      {isSuperAdmin && <p className="mt-3 text-small text-muted-foreground">Super Administrator always has full access — its permissions can&apos;t be reduced.</p>}

      {selectedRole && grantedKeys && (
        <>
          <Table className="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                {ADMIN_ACTIONS.map((action) => (
                  <TableHead key={action}>{action}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ADMIN_MODULES.map((module) => (
                <TableRow key={module}>
                  <TableCell>{module}</TableCell>
                  {ADMIN_ACTIONS.map((action) => (
                    <TableCell key={action}>
                      <Checkbox
                        aria-label={`${module} ${action}`}
                        checked={isSuperAdmin || grantedKeys.has(permissionKey(module, action))}
                        disabled={isSuperAdmin}
                        onCheckedChange={() => toggleCell(module, action)}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Button type="button" className="mt-4" onClick={handleSave} disabled={isSuperAdmin}>
            Save permissions
          </Button>
        </>
      )}

      <Dialog open={cloneOpen} onOpenChange={setCloneOpen}>
        <DialogContent>
          <h2 className="text-h4 font-heading text-charcoal">Clone {selectedRole?.name}</h2>

          <Label htmlFor="clone-role-key" className="mt-3 block">
            New role key
          </Label>
          <Input id="clone-role-key" placeholder="e.g. regional_manager" value={cloneForm.newKey} onChange={(event) => setCloneForm((prev) => ({ ...prev, newKey: event.target.value }))} />

          <Label htmlFor="clone-role-name" className="mt-3 block">
            New role name
          </Label>
          <Input id="clone-role-name" placeholder="e.g. Regional Manager" value={cloneForm.newName} onChange={(event) => setCloneForm((prev) => ({ ...prev, newName: event.target.value }))} />

          <Button type="button" className="mt-4 w-fit" onClick={handleClone} disabled={!cloneForm.newKey.trim() || !cloneForm.newName.trim()}>
            Create role
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
