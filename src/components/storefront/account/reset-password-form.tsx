"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordSchema, type ResetPasswordInput } from "@/validation/auth.schema";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const token = searchParams.get("token") ?? "";

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { email, token, password: "" } });

  const onSubmit = handleSubmit(async (data) => {
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError("root", { message: body?.error ?? "Something went wrong. Please try again." });
      return;
    }

    router.push("/account/login");
  });

  if (!email || !token) {
    return (
      <p role="alert" className="mt-6 text-body text-destructive">
        This password reset link is missing required information. Please request a new one from the{" "}
        <Link href="/account/forgot-password" className="underline-offset-2 hover:underline">
          forgot password
        </Link>{" "}
        page.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
      <input type="hidden" {...register("email")} />
      <input type="hidden" {...register("token")} />

      <div>
        <Label htmlFor="reset-password-password">New password</Label>
        <Input
          id="reset-password-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? "reset-password-password-error" : undefined}
          {...register("password")}
        />
        {errors.password && (
          <p id="reset-password-password-error" className="mt-1 text-small text-destructive">
            {errors.password.message}
          </p>
        )}
      </div>

      {errors.root && (
        <p role="alert" className="text-small text-destructive">
          {errors.root.message}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="sm:self-start">
        {isSubmitting ? "Resetting…" : "Reset password"}
      </Button>
    </form>
  );
}
