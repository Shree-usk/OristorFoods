"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/validation/auth.schema";

/**
 * STORY-033. The API always returns 200 regardless of whether the email
 * is registered — this form shows the same confirmation either way, so
 * the UI can't be used to enumerate accounts either.
 */
export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });

  const onSubmit = handleSubmit(async (data) => {
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSubmitted(true);
  });

  if (submitted) {
    return (
      <p role="status" className="mt-6 text-body text-charcoal">
        If an account exists for that email, we&apos;ve sent a link to reset your password. It expires in 1 hour.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
      <div>
        <Label htmlFor="forgot-password-email">Email address</Label>
        <Input
          id="forgot-password-email"
          type="email"
          autoComplete="email"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "forgot-password-email-error" : undefined}
          {...register("email")}
        />
        {errors.email && (
          <p id="forgot-password-email-error" className="mt-1 text-small text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting} className="sm:self-start">
        {isSubmitting ? "Sending…" : "Send reset link"}
      </Button>

      <p className="text-small text-charcoal/70">
        <Link href="/account/login" className="text-chilli underline-offset-2 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
