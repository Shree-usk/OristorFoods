"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import { createPaymentMethod, deletePaymentMethod, fetchPaymentMethods, updatePaymentMethod } from "@/lib/api/admin-system-settings-client";

const EMPTY_METHOD = { key: "", label: "" };

/**
 * STORY-054. Provider-agnostic — the actual payment gateway is still
 * unconfirmed (docs/blueprint.md Section 10), so this lists configured
 * methods generically (key/label/enabled) rather than hardcoding one
 * gateway's own UI.
 */
export function PaymentMethodsPanel() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [newMethod, setNewMethod] = useState(EMPTY_METHOD);

  const { data } = useQuery({ queryKey: ["admin-settings-payment-methods"], queryFn: fetchPaymentMethods });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-settings-payment-methods"] });
  }

  async function handleToggle(id: string, enabled: boolean) {
    setError(null);
    try {
      await updatePaymentMethod(id, { enabled });
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update the payment method.");
    }
  }

  async function handleAdd() {
    setError(null);
    try {
      await createPaymentMethod({ key: newMethod.key, label: newMethod.label, enabled: true });
      setNewMethod(EMPTY_METHOD);
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add the payment method.");
    }
  }

  async function handleRemove(id: string) {
    setError(null);
    try {
      await deletePaymentMethod(id);
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove the payment method.");
    }
  }

  return (
    <div className="max-w-2xl">
      {error && <p className="mb-2 text-small text-destructive">{error}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Label</TableHead>
            <TableHead>Enabled</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data ?? []).map((method) => (
            <TableRow key={method.id}>
              <TableCell>{method.key}</TableCell>
              <TableCell>{method.label}</TableCell>
              <TableCell>
                <CheckboxOption label="Enabled" checked={method.enabled} onCheckedChange={(checked) => handleToggle(method.id, checked)} />
              </TableCell>
              <TableCell>
                <Button size="sm" variant="destructive" onClick={() => handleRemove(method.id)}>
                  Remove
                </Button>
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell>
              <Input placeholder="e.g. cash_on_delivery" value={newMethod.key} onChange={(event) => setNewMethod((prev) => ({ ...prev, key: event.target.value }))} />
            </TableCell>
            <TableCell>
              <Input placeholder="e.g. Cash on Delivery" value={newMethod.label} onChange={(event) => setNewMethod((prev) => ({ ...prev, label: event.target.value }))} />
            </TableCell>
            <TableCell colSpan={2}>
              <Button size="sm" onClick={handleAdd} disabled={!newMethod.key.trim() || !newMethod.label.trim()}>
                Add
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
