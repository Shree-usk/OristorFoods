"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { credentialsSchema, type CredentialsInput } from "@/validation/auth.schema";

export function LoginForm() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CredentialsInput>({ resolver: zodResolver(credentialsSchema), defaultValues: { email: "", password: "" } });

  const onSubmit = handleSubmit(async (data) => {
    const result = await signIn("credentials", { ...data, redirect: false });
    if (result?.error) {
      setError("root", { message: "Incorrect email or password." });
      return;
    }
    router.push("/");
  });

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 flex flex-col gap-4">
      <div>
        <Label htmlFor="login-email">Email address</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "login-email-error" : undefined}
          {...register("email")}
        />
        {errors.email && (
          <p id="login-email-error" className="mt-1 text-small text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="login-password">Password</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete="current-password"
          aria-invalid={errors.password ? true : undefined}
          aria-describedby={errors.password ? "login-password-error" : undefined}
          {...register("password")}
        />
        {errors.password && (
          <p id="login-password-error" className="mt-1 text-small text-destructive">
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
        {isSubmitting ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-small text-charcoal/70">
        New to Oristor?{" "}
        <Link href="/account/register" className="text-chilli underline-offset-2 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
