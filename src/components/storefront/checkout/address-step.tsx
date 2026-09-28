"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/api-error";
import { fetchSavedAddresses, validateAddress } from "@/lib/api/checkout-client";
import { useCheckoutStore } from "@/lib/stores/checkout-store";
import type { SavedAddress } from "@/types/checkout";
import { checkoutAddressSchema } from "@/validation/checkout.schema";

/**
 * Guests must supply an email (matching the server's own guest check);
 * authenticated customers' identity comes from the session, so the field
 * isn't rendered and stays an empty string.
 */
function buildFormSchema(isAuthenticated: boolean) {
  return z
    .object({
      address: checkoutAddressSchema,
      guestEmail: z.string(),
      save: z.boolean().optional(),
    })
    .superRefine((data, ctx) => {
      if (!isAuthenticated && !z.email().safeParse(data.guestEmail).success) {
        ctx.addIssue({ code: "custom", path: ["guestEmail"], message: "Enter a valid email address" });
      }
    });
}

type AddressFormValues = z.infer<ReturnType<typeof buildFormSchema>>;

const ADDRESS_FIELDS = [
  { name: "recipientName", label: "Recipient name", autoComplete: "name" },
  { name: "phone", label: "Phone number", autoComplete: "tel" },
  { name: "line1", label: "Address line 1", autoComplete: "address-line1" },
  { name: "line2", label: "Address line 2 (optional)", autoComplete: "address-line2" },
  { name: "city", label: "City", autoComplete: "address-level2" },
  { name: "district", label: "District (optional)", autoComplete: "address-level1" },
  { name: "postalCode", label: "Postal code (optional)", autoComplete: "postal-code" },
] as const;

export function AddressStep({ isAuthenticated }: { isAuthenticated: boolean }) {
  const { address, guestEmail, saveAddress, setAddress, goToStep } = useCheckoutStore();

  const savedAddressesQuery = useQuery({
    queryKey: ["checkout-addresses"],
    queryFn: fetchSavedAddresses,
    enabled: isAuthenticated,
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(buildFormSchema(isAuthenticated)),
    defaultValues: {
      address: address ?? { recipientName: "", phone: "", line1: "", line2: "", city: "", district: "", postalCode: "" },
      guestEmail: guestEmail ?? "",
      save: saveAddress,
    },
  });

  function applySavedAddress(saved: SavedAddress) {
    reset({
      address: {
        recipientName: saved.recipientName,
        phone: saved.phone,
        line1: saved.line1,
        line2: saved.line2 ?? "",
        city: saved.city,
        district: saved.district ?? "",
        postalCode: saved.postalCode ?? "",
      },
      guestEmail: "",
      save: false,
    });
  }

  const onSubmit = handleSubmit(async (data) => {
    try {
      // Server-side validation of the same schema before advancing —
      // saving (authed + save:true) happens at place-order, not here, so
      // an abandoned checkout doesn't collect addresses.
      await validateAddress({ address: data.address, guestEmail: data.guestEmail || undefined });
      setAddress(data.address, isAuthenticated ? null : (data.guestEmail ?? null), data.save ?? false);
      goToStep(2);
    } catch (error) {
      setError("root", { message: error instanceof ApiError ? error.message : "Something went wrong. Please try again." });
    }
  });

  return (
    <div>
      <h2 className="text-h3 font-heading text-charcoal">Delivery Address</h2>

      {!isAuthenticated && (
        <p className="mt-2 text-small text-charcoal/70">
          Checking out as a guest — no account needed.{" "}
          <Link href="/account/login" className="text-chilli underline-offset-2 hover:underline">
            Log in for faster checkout
          </Link>
        </p>
      )}

      {isAuthenticated && (savedAddressesQuery.data?.length ?? 0) > 0 && (
        <fieldset className="mt-4">
          <legend className="text-small font-semibold text-charcoal">Saved addresses</legend>
          <ul className="mt-2 flex flex-col gap-2">
            {savedAddressesQuery.data!.map((saved) => (
              <li key={saved.id}>
                <button
                  type="button"
                  onClick={() => applySavedAddress(saved)}
                  className="w-full rounded-lg border border-input p-3 text-left text-small text-charcoal transition-colors hover:border-chilli"
                >
                  <span className="font-semibold">{saved.recipientName}</span>
                  {saved.isDefault && <span className="ml-2 rounded bg-cream px-1.5 py-0.5 text-caption">Default</span>}
                  <span className="mt-1 block text-charcoal/70">
                    {saved.line1}
                    {saved.line2 ? `, ${saved.line2}` : ""}, {saved.city}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-caption text-charcoal/70">Selecting one fills the form below — you can still edit it.</p>
        </fieldset>
      )}

      <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
        {!isAuthenticated && (
          <div>
            <Label htmlFor="checkout-guest-email">Email address</Label>
            <Input
              id="checkout-guest-email"
              type="email"
              autoComplete="email"
              aria-invalid={errors.guestEmail ? true : undefined}
              aria-describedby={errors.guestEmail ? "checkout-guest-email-error" : undefined}
              {...register("guestEmail")}
            />
            {errors.guestEmail && (
              <p id="checkout-guest-email-error" className="mt-1 text-small text-destructive">
                {errors.guestEmail.message}
              </p>
            )}
          </div>
        )}

        {ADDRESS_FIELDS.map((field) => {
          const fieldError = errors.address?.[field.name];
          const id = `checkout-${field.name}`;
          return (
            <div key={field.name}>
              <Label htmlFor={id}>{field.label}</Label>
              <Input
                id={id}
                autoComplete={field.autoComplete}
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={fieldError ? `${id}-error` : undefined}
                {...register(`address.${field.name}`)}
              />
              {fieldError && (
                <p id={`${id}-error`} className="mt-1 text-small text-destructive">
                  {fieldError.message}
                </p>
              )}
            </div>
          );
        })}

        {isAuthenticated && (
          <div className="flex items-center gap-2">
            {/* Native checkbox: the Radix Checkbox isn't a form input, so
                RHF's register() can't drive it without a Controller. */}
            <input id="checkout-save-address" type="checkbox" className="size-4 accent-chilli" {...register("save")} />
            <Label htmlFor="checkout-save-address" className="font-normal">
              Save this address for next time
            </Label>
          </div>
        )}

        {errors.root && (
          <p role="alert" className="text-small text-destructive">
            {errors.root.message}
          </p>
        )}

        <Button type="submit" disabled={isSubmitting} className="sm:self-start">
          Continue to Delivery
        </Button>
      </form>
    </div>
  );
}
