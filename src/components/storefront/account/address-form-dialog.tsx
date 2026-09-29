"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addressSchema, type AddressInput } from "@/validation/address.schema";

const COUNTRIES = [
  { code: "LK", name: "Sri Lanka" },
  { code: "AU", name: "Australia" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
  { code: "AE", name: "United Arab Emirates" },
] as const;

const EMPTY_VALUES: AddressInput = {
  label: "Home",
  type: "Both",
  recipientName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  district: "",
  postalCode: "",
  country: "LK",
  companyName: "",
  taxId: "",
  setAsDefaultBilling: false,
  setAsDefaultShipping: false,
};

export interface AddressFormValues extends AddressInput {
  id?: string;
}

interface AddressFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialValues?: AddressFormValues;
  onSubmit: (values: AddressInput) => Promise<void>;
}

/** STORY-034. Add/edit both use this — `initialValues` present means edit. Distributor fields (company/tax id) always shown; never required. */
export function AddressFormDialog({ open, onOpenChange, initialValues, onSubmit }: AddressFormDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AddressInput>({ resolver: zodResolver(addressSchema), defaultValues: EMPTY_VALUES });

  const country = watch("country");
  const isSriLanka = country === "LK";

  useEffect(() => {
    if (open) {
      reset(initialValues ?? EMPTY_VALUES);
      setServerError(null);
    }
  }, [open, initialValues, reset]);

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch {
      setServerError("Something went wrong. Please try again.");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <h2 className="text-h3 font-heading text-charcoal">{initialValues ? "Edit address" : "Add address"}</h2>

        <form onSubmit={submit} noValidate className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="address-label">Label</Label>
            <Controller
              control={control}
              name="label"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="address-label" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Home">Home</SelectItem>
                    <SelectItem value="Work">Work</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div>
            <Label htmlFor="address-type">Use for</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="address-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Both">Shipping &amp; billing</SelectItem>
                    <SelectItem value="Shipping">Shipping only</SelectItem>
                    <SelectItem value="Billing">Billing only</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="address-recipient">Recipient name</Label>
            <Input id="address-recipient" {...register("recipientName")} />
            {errors.recipientName && (
              <p className="mt-1 text-small text-destructive" role="alert">
                {errors.recipientName.message}
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="address-phone">Phone number</Label>
            <Input id="address-phone" type="tel" {...register("phone")} />
            {errors.phone && (
              <p className="mt-1 text-small text-destructive" role="alert">
                {errors.phone.message}
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="address-line1">Address line 1</Label>
            <Input id="address-line1" {...register("line1")} />
            {errors.line1 && (
              <p className="mt-1 text-small text-destructive" role="alert">
                {errors.line1.message}
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="address-line2">Address line 2 (optional)</Label>
            <Input id="address-line2" {...register("line2")} />
          </div>

          <div>
            <Label htmlFor="address-city">City</Label>
            <Input id="address-city" {...register("city")} />
            {errors.city && (
              <p className="mt-1 text-small text-destructive" role="alert">
                {errors.city.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="address-country">Country</Label>
            <Controller
              control={control}
              name="country"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="address-country" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div>
            <Label htmlFor="address-district">{isSriLanka ? "District" : "State / Province"}</Label>
            <Input id="address-district" {...register("district")} />
            {errors.district && (
              <p className="mt-1 text-small text-destructive" role="alert">
                {errors.district.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="address-postal">Postal code{isSriLanka ? " (optional)" : ""}</Label>
            <Input id="address-postal" {...register("postalCode")} />
            {errors.postalCode && (
              <p className="mt-1 text-small text-destructive" role="alert">
                {errors.postalCode.message}
              </p>
            )}
          </div>

          <div className="sm:col-span-2">
            <p className="text-small font-medium text-charcoal">Business address (optional)</p>
          </div>

          <div>
            <Label htmlFor="address-company">Company name</Label>
            <Input id="address-company" {...register("companyName")} />
          </div>

          <div>
            <Label htmlFor="address-tax-id">Tax / VAT ID</Label>
            <Input id="address-tax-id" {...register("taxId")} />
          </div>

          <div className="flex items-center gap-2 sm:col-span-2">
            <input id="address-default-billing" type="checkbox" className="size-4 accent-chilli" {...register("setAsDefaultBilling")} />
            <Label htmlFor="address-default-billing" className="font-normal">
              Set as default billing address
            </Label>
          </div>

          <div className="flex items-center gap-2 sm:col-span-2">
            <input id="address-default-shipping" type="checkbox" className="size-4 accent-chilli" {...register("setAsDefaultShipping")} />
            <Label htmlFor="address-default-shipping" className="font-normal">
              Set as default shipping address
            </Label>
          </div>

          {serverError && (
            <p role="alert" className="text-small text-destructive sm:col-span-2">
              {serverError}
            </p>
          )}

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save address"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
