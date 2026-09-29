"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastManager } from "@/lib/toast";
import { updatePreferencesSchema, type UpdatePreferencesInput } from "@/validation/notification.schema";

async function fetchPreferences(): Promise<UpdatePreferencesInput> {
  const response = await fetch("/api/notifications/preferences", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to load your notification preferences");
  return response.json() as Promise<UpdatePreferencesInput>;
}

const DEFAULT_VALUES: UpdatePreferencesInput = {
  phone: "",
  emailOptIn: true,
  marketingOptIn: false,
  smsOptIn: false,
  whatsappOptIn: false,
  rewardUpdatesOptIn: true,
};

/**
 * STORY-032's channel toggles (SMS/WhatsApp/phone), extended by STORY-034
 * with the AC's full toggle set: order-update emails (`emailOptIn`),
 * promotional emails (`marketingOptIn` — actually User.marketingOptIn,
 * not a NotificationPreference field; see notification.schema.ts), and
 * reward/referral updates (`rewardUpdatesOptIn`). Mounted on
 * /account/notifications (STORY-034).
 */
export function NotificationPreferencesForm() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery({ queryKey: ["notification-preferences"], queryFn: fetchPreferences });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePreferencesInput>({
    resolver: zodResolver(updatePreferencesSchema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (data) reset({ ...DEFAULT_VALUES, ...data });
  }, [data, reset]);

  const onSubmit = handleSubmit(async (values) => {
    const response = await fetch("/api/notifications/preferences", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!response.ok) {
      setError("root", { message: "Something went wrong. Please try again." });
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["notification-preferences"] });
    toastManager.add({ title: "Notification preferences saved" });
  });

  if (isPending) return <p className="text-small text-charcoal/70">Loading your notification preferences…</p>;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div>
        <Label htmlFor="notification-phone">Phone number</Label>
        <Input id="notification-phone" type="tel" autoComplete="tel" {...register("phone")} />
      </div>

      <div className="flex items-center gap-2">
        <input id="notification-order-updates" type="checkbox" className="size-4 accent-chilli" {...register("emailOptIn")} />
        <Label htmlFor="notification-order-updates" className="font-normal">
          Order update emails
        </Label>
      </div>

      <div className="flex items-center gap-2">
        <input id="notification-promotions" type="checkbox" className="size-4 accent-chilli" {...register("marketingOptIn")} />
        <Label htmlFor="notification-promotions" className="font-normal">
          Promotional emails
        </Label>
      </div>

      <div className="flex items-center gap-2">
        <input id="notification-rewards" type="checkbox" className="size-4 accent-chilli" {...register("rewardUpdatesOptIn")} />
        <Label htmlFor="notification-rewards" className="font-normal">
          Reward &amp; referral updates
        </Label>
      </div>

      <div className="flex items-center gap-2">
        <input id="notification-sms" type="checkbox" className="size-4 accent-chilli" {...register("smsOptIn")} />
        <Label htmlFor="notification-sms" className="font-normal">
          Send me SMS updates
        </Label>
      </div>

      <div className="flex items-center gap-2">
        <input id="notification-whatsapp" type="checkbox" className="size-4 accent-chilli" {...register("whatsappOptIn")} />
        <Label htmlFor="notification-whatsapp" className="font-normal">
          Send me WhatsApp updates
        </Label>
      </div>

      {errors.root && (
        <p role="alert" className="text-small text-destructive">
          {errors.root.message}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="sm:self-start">
        {isSubmitting ? "Saving…" : "Save preferences"}
      </Button>
    </form>
  );
}
