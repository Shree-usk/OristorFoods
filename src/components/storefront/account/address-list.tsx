"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { AddressCard, type AddressRow } from "@/components/storefront/account/address-card";
import { AddressFormDialog, type AddressFormValues } from "@/components/storefront/account/address-form-dialog";
import { toastManager } from "@/lib/toast";
import type { AddressInput } from "@/validation/address.schema";

const QUERY_KEY = ["account-addresses"];

async function fetchAddresses(): Promise<AddressRow[]> {
  const response = await fetch("/api/account/addresses", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to load your addresses");
  return response.json() as Promise<AddressRow[]>;
}

/** STORY-034. The account address book — list, add, edit, delete, and independently set default billing/shipping. */
export function AddressList() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: QUERY_KEY, queryFn: fetchAddresses });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AddressFormValues | undefined>(undefined);
  const [listError, setListError] = useState<string | null>(null);

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }

  function openAddDialog() {
    setEditing(undefined);
    setListError(null);
    setDialogOpen(true);
  }

  function openEditDialog(address: AddressRow) {
    setEditing({ ...address, line2: address.line2 ?? "", district: address.district ?? "", postalCode: address.postalCode ?? "", companyName: address.companyName ?? "", taxId: address.taxId ?? "", setAsDefaultBilling: false, setAsDefaultShipping: false });
    setListError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(values: AddressInput) {
    const isEdit = Boolean(editing?.id);
    const response = await fetch(isEdit ? `/api/account/addresses/${editing!.id}` : "/api/account/addresses", {
      method: isEdit ? "PATCH" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Failed to save address");
    }
    await invalidate();
    toastManager.add({ title: isEdit ? "Address updated" : "Address added" });
  }

  async function handleDelete(id: string) {
    setListError(null);
    const response = await fetch(`/api/account/addresses/${id}`, { method: "DELETE", credentials: "include" });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setListError(body?.error ?? "Failed to delete address");
      return;
    }
    await invalidate();
    toastManager.add({ title: "Address deleted" });
  }

  async function handleSetDefault(id: string, kind: "billing" | "shipping") {
    setListError(null);
    const response = await fetch(`/api/account/addresses/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(kind === "billing" ? { setAsDefaultBilling: true } : { setAsDefaultShipping: true }),
    });
    if (!response.ok) {
      setListError("Failed to update default address");
      return;
    }
    await invalidate();
    toastManager.add({ title: kind === "billing" ? "Default billing address updated" : "Default shipping address updated" });
  }

  if (isPending) return <p className="text-small text-charcoal/70">Loading your addresses…</p>;

  const addresses = data ?? [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-small text-charcoal/70">{addresses.length} of 10 saved</p>
        <Button onClick={openAddDialog} disabled={addresses.length >= 10}>
          Add address
        </Button>
      </div>

      {listError && (
        <p role="alert" className="mt-2 text-small text-destructive">
          {listError}
        </p>
      )}

      {addresses.length === 0 ? (
        <p className="mt-6 text-body text-charcoal/70">You haven&apos;t saved any addresses yet.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {addresses.map((address) => (
            <AddressCard
              key={address.id}
              address={address}
              onEdit={() => openEditDialog(address)}
              onDelete={() => handleDelete(address.id)}
              onSetDefaultBilling={() => handleSetDefault(address.id, "billing")}
              onSetDefaultShipping={() => handleSetDefault(address.id, "shipping")}
            />
          ))}
        </div>
      )}

      <AddressFormDialog open={dialogOpen} onOpenChange={setDialogOpen} initialValues={editing} onSubmit={handleSubmit} />
    </div>
  );
}
