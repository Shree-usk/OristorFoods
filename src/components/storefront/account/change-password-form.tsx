"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastManager } from "@/lib/toast";
import { changePasswordSchema, type ChangePasswordInput } from "@/validation/security.schema";

/**
 * STORY-034. On success, every session — including this one — is
 * invalidated (see security.service.ts), so this signs the customer out
 * and redirects to login rather than staying on the page.
 */
export function ChangePasswordForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema), defaultValues: { currentPassword: "", newPassword: "" } });

  const onSubmit = handleSubmit(async (values) => {
    const response = await fetch("/api/account/security/password", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError("root", { message: body?.error ?? "Something went wrong. Please try again." });
      return;
    }
    toastManager.add({ title: "Password changed", description: "Please sign in again." });
    await signOut({ redirect: false });
    router.push("/account/login");
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div>
        <Label htmlFor="change-password-current">Current password</Label>
        <Input id="change-password-current" type="password" autoComplete="current-password" {...register("currentPassword")} />
        {errors.currentPassword && (
          <p className="mt-1 text-small text-destructive" role="alert">
            {errors.currentPassword.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="change-password-new">New password</Label>
        <Input id="change-password-new" type="password" autoComplete="new-password" {...register("newPassword")} />
        {errors.newPassword && (
          <p className="mt-1 text-small text-destructive" role="alert">
            {errors.newPassword.message}
          </p>
        )}
      </div>

      {errors.root && (
        <p role="alert" className="text-small text-destructive">
          {errors.root.message}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="sm:self-start">
        {isSubmitting ? "Changing…" : "Change password"}
      </Button>
    </form>
  );
}
