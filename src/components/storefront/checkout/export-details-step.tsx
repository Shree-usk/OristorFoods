"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchPickupLocation } from "@/lib/api/checkout-client";
import { useCheckoutStore } from "@/lib/stores/checkout-store";
import { checkoutExportDetailsStepSchema, type CheckoutExportDetailsStepInput } from "@/validation/checkout.schema";

/**
 * Export fulfilment flow. New Step 1, shown only for a cart with an
 * export-declared packaging line (checkout-wizard.tsx's gate). Collects
 * the traveler's own details (needed either way) and forks the rest of
 * checkout: Pickup skips Address/Delivery entirely (jumps to Payment),
 * Deliver continues through the normal Sri Lanka address/delivery-zone
 * flow with these traveler fields layered on top.
 */
export function ExportDetailsStep() {
  const { fulfilmentMethod, traveler, setExportDetails, goToStep } = useCheckoutStore();

  const pickupLocationQuery = useQuery({ queryKey: ["checkout-pickup-location"], queryFn: fetchPickupLocation });
  const pickupAvailable = Boolean(pickupLocationQuery.data);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutExportDetailsStepInput>({
    resolver: zodResolver(checkoutExportDetailsStepSchema),
    defaultValues: {
      fulfilmentMethod: fulfilmentMethod ?? "Delivery",
      traveler: traveler ?? { travelerName: "", travelerCountry: "", travelerPhone: "" },
    },
  });

  const selectedFulfilmentMethod = watch("fulfilmentMethod");

  const onSubmit = handleSubmit((data) => {
    setExportDetails(data.fulfilmentMethod, data.traveler);
    goToStep(data.fulfilmentMethod === "Pickup" ? 4 : 2);
  });

  return (
    <div>
      <h2 className="text-h3 font-heading text-charcoal">Taking This Abroad</h2>
      <p className="mt-2 text-small text-charcoal/70">
        Your order includes an item packaged for export. We just need a few details before you continue.
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
        <fieldset>
          <legend className="text-small font-semibold text-charcoal">How will you get it?</legend>
          <div className="mt-2 flex flex-col gap-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-input p-3 transition-colors has-checked:border-chilli">
              <input type="radio" value="Delivery" className="mt-1 accent-chilli" {...register("fulfilmentMethod")} />
              <span className="block text-body text-charcoal">Deliver to my address</span>
            </label>
            <label
              className={`flex items-start gap-3 rounded-lg border border-input p-3 transition-colors has-checked:border-chilli ${
                pickupLocationQuery.isPending || pickupAvailable ? "cursor-pointer" : "cursor-not-allowed opacity-50"
              }`}
            >
              <input
                type="radio"
                value="Pickup"
                className="mt-1 accent-chilli"
                disabled={!pickupLocationQuery.isPending && !pickupAvailable}
                {...register("fulfilmentMethod")}
              />
              <span>
                <span className="block text-body text-charcoal">I&apos;ll collect it myself</span>
                {!pickupLocationQuery.isPending && !pickupAvailable && (
                  <span className="block text-caption text-charcoal/60">Not available right now.</span>
                )}
              </span>
            </label>
          </div>
        </fieldset>

        {selectedFulfilmentMethod === "Pickup" && pickupLocationQuery.data && (
          <div className="rounded-lg border border-input bg-cream p-4 text-small text-charcoal">
            <p className="font-semibold">{pickupLocationQuery.data.name}</p>
            <p className="mt-1 text-charcoal/70">{pickupLocationQuery.data.address}</p>
            {pickupLocationQuery.data.mapUrl && (
              <a
                href={pickupLocationQuery.data.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-chilli underline-offset-2 hover:underline"
              >
                View on map
              </a>
            )}
          </div>
        )}

        <fieldset className="flex flex-col gap-4">
          <legend className="text-small font-semibold text-charcoal">Your details</legend>
          <div>
            <Label htmlFor="checkout-traveler-name">Name</Label>
            <Input
              id="checkout-traveler-name"
              autoComplete="name"
              aria-invalid={errors.traveler?.travelerName ? true : undefined}
              {...register("traveler.travelerName")}
            />
            {errors.traveler?.travelerName && <p className="mt-1 text-small text-destructive">{errors.traveler.travelerName.message}</p>}
          </div>
          <div>
            <Label htmlFor="checkout-traveler-country">Country you&apos;re visiting</Label>
            <Input id="checkout-traveler-country" aria-invalid={errors.traveler?.travelerCountry ? true : undefined} {...register("traveler.travelerCountry")} />
            {errors.traveler?.travelerCountry && <p className="mt-1 text-small text-destructive">{errors.traveler.travelerCountry.message}</p>}
          </div>
          <div>
            <Label htmlFor="checkout-traveler-phone">Local contact number</Label>
            <Input
              id="checkout-traveler-phone"
              autoComplete="tel"
              aria-invalid={errors.traveler?.travelerPhone ? true : undefined}
              {...register("traveler.travelerPhone")}
            />
            {errors.traveler?.travelerPhone && <p className="mt-1 text-small text-destructive">{errors.traveler.travelerPhone.message}</p>}
          </div>
        </fieldset>

        <Button type="submit" disabled={isSubmitting} className="sm:self-start">
          Continue
        </Button>
      </form>
    </div>
  );
}
