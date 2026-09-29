"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastManager } from "@/lib/toast";
import { changeEmailSchema, type ChangeEmailInput } from "@/validation/profile.schema";

interface EmailData {
  email: string | null;
  pendingEmail: string | null;
}

async function fetchEmail(): Promise<EmailData> {
  const response = await fetch("/api/account/profile", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to load your account");
  return response.json() as Promise<EmailData>;
}

/**
 * STORY-034. A separate action from the rest of the profile form — email
 * never changes immediately, only once the mailed verification link is
 * confirmed (see /account/profile/verify-email).
 */
export function EmailChangeForm() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["account-profile"], queryFn: fetchEmail });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangeEmailInput>({ resolver: zodResolver(changeEmailSchema), defaultValues: { email: "" } });

  const onSubmit = handleSubmit(async (values) => {
    const response = await fetch("/api/account/profile/email", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError("root", { message: body?.error ?? "Something went wrong. Please try again." });
      return;
    }
    reset({ email: "" });
    await queryClient.invalidateQueries({ queryKey: ["account-profile"] });
    toastManager.add({ title: "Verification email sent", description: "Confirm the link we sent to finish updating your email." });
  });

  return (
    <div className="flex flex-col gap-2">
      <p className="text-small text-charcoal/70">Current email: {data?.email ?? "…"}</p>
      {data?.pendingEmail && (
        <p role="status" className="text-small text-charcoal">
          Pending confirmation: <span className="font-medium">{data.pendingEmail}</span> — check your inbox for a verification link.
        </p>
      )}

      <form onSubmit={onSubmit} noValidate className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label htmlFor="email-change-new">New email address</Label>
          <Input id="email-change-new" type="email" autoComplete="email" {...register("email")} />
          {errors.email && (
            <p className="mt-1 text-small text-destructive" role="alert">
              {errors.email.message}
            </p>
          )}
        </div>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Sending…" : "Change email"}
        </Button>
      </form>

      {errors.root && (
        <p role="alert" className="text-small text-destructive">
          {errors.root.message}
        </p>
      )}
    </div>
  );
}
