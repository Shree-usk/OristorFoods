"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import {
  createPaymentMethod,
  deletePaymentMethod,
  fetchPaymentMethods,
  updatePaymentMethod,
  type PaymentMethodTag,
} from "@/lib/api/admin-system-settings-client";

const EMPTY_METHOD: { key: string; label: string; method: PaymentMethodTag | ""; allowedForRestrictedOrders: boolean } = {
  key: "",
  label: "",
  method: "",
  allowedForRestrictedOrders: false,
};

const METHOD_TAGS = ["", "Card", "BankTransfer", "CashOnDelivery"] as const;
const METHOD_TAG_LABELS: Record<(typeof METHOD_TAGS)[number], string> = {
  "": "— not wired to checkout —",
  Card: "Card",
  BankTransfer: "Bank Transfer",
  CashOnDelivery: "Cash on Delivery",
};

/**
 * STORY-054, extended by Story 4 (Payment Restriction). Provider-agnostic
 * — the actual payment gateway is still unconfirmed (docs/blueprint.md
 * Section 10), so this lists configured methods generically (key/label/
 * enabled) rather than hardcoding one gateway's own UI. `method` is the
 * Story 4 addition: tagging a row with a concrete PaymentMethod is what
 * makes it actually selectable at checkout (an untagged row stays exactly
 * as decorative as every row was before this story).
 * `allowedForRestrictedOrders` is the admin-configurable source of truth
 * for the brief's "card + bank transfer only" rule — never hardcoded in
 * code, per this project's Admin Console Principle.
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

  async function handleAllowedToggle(id: string, allowedForRestrictedOrders: boolean) {
    setError(null);
    try {
      await updatePaymentMethod(id, { allowedForRestrictedOrders });
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update the payment method.");
    }
  }

  async function handleMethodChange(id: string, method: PaymentMethodTag | "") {
    setError(null);
    try {
      await updatePaymentMethod(id, { method: method === "" ? null : method });
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update the payment method.");
    }
  }

  async function handleAdd() {
    setError(null);
    try {
      await createPaymentMethod({
        key: newMethod.key,
        label: newMethod.label,
        enabled: true,
        method: newMethod.method === "" ? null : newMethod.method,
        allowedForRestrictedOrders: newMethod.allowedForRestrictedOrders,
      });
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
    <div className="max-w-4xl">
      {error && <p className="mb-2 text-small text-destructive">{error}</p>}
      <p className="mb-3 text-small text-charcoal/70">
        Only a row tagged with a checkout method below is actually selectable at checkout. &quot;Allowed when restricted&quot;
        controls whether it stays available on an order containing custom packaging (brief Section 6: card and bank transfer
        only).
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Label</TableHead>
            <TableHead>Checkout method</TableHead>
            <TableHead>Allowed when restricted</TableHead>
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
                <Select value={method.method ?? ""} onValueChange={(value) => handleMethodChange(method.id, value as PaymentMethodTag | "")}>
                  <SelectTrigger className="w-48">
                    <SelectValue>{(selected: string | null) => METHOD_TAG_LABELS[(selected ?? "") as (typeof METHOD_TAGS)[number]]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {METHOD_TAGS.map((tag) => (
                      <SelectItem key={tag} value={tag}>
                        {METHOD_TAG_LABELS[tag]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <CheckboxOption
                  label="Allowed"
                  checked={method.allowedForRestrictedOrders}
                  onCheckedChange={(checked) => handleAllowedToggle(method.id, checked)}
                />
              </TableCell>
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
            <TableCell>
              <Select value={newMethod.method} onValueChange={(value) => setNewMethod((prev) => ({ ...prev, method: value as PaymentMethodTag | "" }))}>
                <SelectTrigger className="w-48">
                  <SelectValue>{(selected: string | null) => METHOD_TAG_LABELS[(selected ?? "") as (typeof METHOD_TAGS)[number]]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {METHOD_TAGS.map((tag) => (
                    <SelectItem key={tag} value={tag}>
                      {METHOD_TAG_LABELS[tag]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              <CheckboxOption
                label="Allowed"
                checked={newMethod.allowedForRestrictedOrders}
                onCheckedChange={(checked) => setNewMethod((prev) => ({ ...prev, allowedForRestrictedOrders: checked }))}
              />
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
