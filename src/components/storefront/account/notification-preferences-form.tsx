"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePreferencesSchema, type UpdatePreferencesInput } from "@/validation/notification.schema";

async function fetchPreferences(): Promise<UpdatePreferencesInput> {
  const response = await fetch("/api/notifications/preferences", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to load your notification preferences");
  return response.json() as Promise<UpdatePreferencesInput>;
}

/**
 * Email/SMS/WhatsApp opt-in toggles + phone number (STORY-032). This is
 * the base component only — embedding it into a full account-settings
 * page is STORY-034's job. Not rendered on any page yet; import it from
 * wherever that settings page lands. Email has no opt-out toggle here on
 * purpose: it's default-on for transactional notifications (see
 * notification.service.ts's doc comment) — this form only controls the
 * two consent-requiring channels.
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
    defaultValues: { phone: "", smsOptIn: false, whatsappOptIn: false },
  });

  useEffect(() => {
    if (data) reset({ phone: data.phone ?? "", smsOptIn: data.smsOptIn, whatsappOptIn: data.whatsappOptIn });
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
  });

  if (isPending) return <p className="text-small text-charcoal/70">Loading your notification preferences…</p>;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div>
        <Label htmlFor="notification-phone">Phone number</Label>
        <Input id="notification-phone" type="tel" autoComplete="tel" {...register("phone")} />
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
