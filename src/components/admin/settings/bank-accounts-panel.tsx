"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import {
  createBankAccount,
  deleteBankAccount,
  fetchBankAccounts,
  updateBankAccount,
} from "@/lib/api/admin-system-settings-client";

const EMPTY_ACCOUNT = {
  bankName: "",
  accountName: "",
  accountNumber: "",
  branch: "",
  swiftCode: "",
  currency: "LKR",
};

/**
 * Export fulfilment flow. Every enabled row here is shown to the customer at
 * checkout when they choose Bank Transfer — they pick whichever account
 * suits them (e.g. by currency), there is no server-side selection.
 */
export function BankAccountsPanel() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [newAccount, setNewAccount] = useState(EMPTY_ACCOUNT);

  const { data } = useQuery({ queryKey: ["admin-settings-bank-accounts"], queryFn: fetchBankAccounts });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-settings-bank-accounts"] });
  }

  async function handleToggle(id: string, enabled: boolean) {
    setError(null);
    try {
      await updateBankAccount(id, { enabled });
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update the bank account.");
    }
  }

  async function handleAdd() {
    setError(null);
    try {
      await createBankAccount({
        bankName: newAccount.bankName,
        accountName: newAccount.accountName,
        accountNumber: newAccount.accountNumber,
        branch: newAccount.branch || null,
        swiftCode: newAccount.swiftCode || null,
        currency: newAccount.currency,
        enabled: true,
      });
      setNewAccount(EMPTY_ACCOUNT);
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add the bank account.");
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    try {
      await deleteBankAccount(id);
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove the bank account.");
    }
  }

  return (
    <div className="max-w-5xl">
      {error && <p className="mb-2 text-small text-destructive">{error}</p>}
      <p className="mb-3 text-small text-charcoal/70">
        Accounts shown here, when enabled, are all displayed to the customer at checkout once they choose Bank Transfer —
        they pick whichever suits them. Add one row per account.
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Bank</TableHead>
            <TableHead>Account name</TableHead>
            <TableHead>Account number</TableHead>
            <TableHead>Branch</TableHead>
            <TableHead>SWIFT</TableHead>
            <TableHead>Currency</TableHead>
            <TableHead>Enabled</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data ?? []).map((account) => (
            <TableRow key={account.id}>
              <TableCell>{account.bankName}</TableCell>
              <TableCell>{account.accountName}</TableCell>
              <TableCell>{account.accountNumber}</TableCell>
              <TableCell>{account.branch ?? "—"}</TableCell>
              <TableCell>{account.swiftCode ?? "—"}</TableCell>
              <TableCell>{account.currency}</TableCell>
              <TableCell>
                <CheckboxOption label="Enabled" checked={account.enabled} onCheckedChange={(checked) => handleToggle(account.id, checked)} />
              </TableCell>
              <TableCell>
                <Button size="sm" variant="destructive" onClick={() => handleRemove(account.id)}>
                  Remove
                </Button>
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell>
              <Input placeholder="e.g. Commercial Bank" value={newAccount.bankName} onChange={(event) => setNewAccount((prev) => ({ ...prev, bankName: event.target.value }))} />
            </TableCell>
            <TableCell>
              <Input placeholder="e.g. Oristor Food Products (Pvt) Ltd" value={newAccount.accountName} onChange={(event) => setNewAccount((prev) => ({ ...prev, accountName: event.target.value }))} />
            </TableCell>
            <TableCell>
              <Input placeholder="Account number" value={newAccount.accountNumber} onChange={(event) => setNewAccount((prev) => ({ ...prev, accountNumber: event.target.value }))} />
            </TableCell>
            <TableCell>
              <Input placeholder="Branch" value={newAccount.branch} onChange={(event) => setNewAccount((prev) => ({ ...prev, branch: event.target.value }))} />
            </TableCell>
            <TableCell>
              <Input placeholder="SWIFT code" value={newAccount.swiftCode} onChange={(event) => setNewAccount((prev) => ({ ...prev, swiftCode: event.target.value }))} />
            </TableCell>
            <TableCell>
              <Input placeholder="LKR" value={newAccount.currency} onChange={(event) => setNewAccount((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))} />
            </TableCell>
            <TableCell colSpan={2}>
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={!newAccount.bankName.trim() || !newAccount.accountName.trim() || !newAccount.accountNumber.trim()}
              >
                Add
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
