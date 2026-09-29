"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerSchema, type RegisterInput } from "@/validation/auth.schema";

/**
 * Minimal account creation (STORY-031's prerequisite). No email
 * verification, no profile fields beyond name — full account management
 * belongs to whichever future story owns it. On success, signs the
 * customer straight in (next-auth/react's signIn) and sends them home;
 * any referral attribution cookie already present is applied server-side
 * by the /api/auth/register route itself before this redirect happens.
 */
export function RegisterForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema), defaultValues: { name: "", email: "", password: "" } });

  const onSubmit = handleSubmit(async (data) => {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError("root", { message: body?.error ?? "Something went wrong. Please try again." });
      return;
    }

    const result = await signIn("credentials", { email: data.email, password: data.password, redirect: false });
    if (result?.error) {
      setError("root", { message: "Account created — please sign in." });
      router.push("/account/login");
      return;
    }
    router.push("/");
  });

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
      <div>
        <Label htmlFor="register-name">Name (optional)</Label>
        <Input id="register-name" autoComplete="name" {...register("name")} />
      </div>

      <div>
        <Label htmlFor="register-email">Email address</Label>
        <Input
          id="register-email"
          type="email"
          autoComplete="email"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "register-email-error" : undefined}
          {...register("email")}
        />
        {errors.email && (
          <p id="register-email-error" className="mt-1 text-small text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="register-password">Password</Label>
        <Input
          id="register-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? "register-password-error" : undefined}
          {...register("password")}
        />
        {errors.password && (
          <p id="register-password-error" className="mt-1 text-small text-destructive">
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
        {isSubmitting ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-small text-charcoal/70">
        Already have an account?{" "}
        <Link href="/account/login" className="text-chilli underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
