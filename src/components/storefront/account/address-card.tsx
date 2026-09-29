"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export interface AddressRow {
  id: string;
  label: "Home" | "Work" | "Other";
  type: "Shipping" | "Billing" | "Both";
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  district: string | null;
  postalCode: string | null;
  country: string;
  companyName: string | null;
  taxId: string | null;
  isDefaultBilling: boolean;
  isDefaultShipping: boolean;
}

interface AddressCardProps {
  address: AddressRow;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefaultBilling: () => void;
  onSetDefaultShipping: () => void;
}

export function AddressCard({ address, onEdit, onDelete, onSetDefaultBilling, onSetDefaultShipping }: AddressCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-charcoal">{address.label}</span>
            <Badge variant="outline">{address.type}</Badge>
          </div>
          <div className="flex gap-1">
            {address.isDefaultBilling && <Badge variant="secondary">Default billing</Badge>}
            {address.isDefaultShipping && <Badge variant="secondary">Default shipping</Badge>}
          </div>
        </div>

        <div className="text-small text-charcoal/80">
          <p>{address.recipientName}</p>
          {address.companyName && <p>{address.companyName}</p>}
          <p>{address.line1}</p>
          {address.line2 && <p>{address.line2}</p>}
          <p>
            {address.city}
            {address.district ? `, ${address.district}` : ""} {address.postalCode ?? ""}
          </p>
          <p>{address.country}</p>
          <p>{address.phone}</p>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onEdit}>
            Edit
          </Button>
          <Button size="sm" variant="outline" onClick={onDelete}>
            Delete
          </Button>
          {!address.isDefaultBilling && (
            <Button size="sm" variant="ghost" onClick={onSetDefaultBilling}>
              Set default billing
            </Button>
          )}
          {!address.isDefaultShipping && (
            <Button size="sm" variant="ghost" onClick={onSetDefaultShipping}>
              Set default shipping
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
