"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Only ever a same-origin relative path — never redirect to an attacker-supplied absolute URL. Mirrors login-form.tsx's own guard. */
function safeCallbackUrl(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/admin";
}

/**
 * STORY-038. Deliberately does NOT use next-auth/react's signIn()/
 * getCsrfToken() — those are bound to the single global SessionProvider's
 * basePath (this app's customer instance, src/app/providers.tsx), with no
 * per-call override available in this version. Instead this replicates
 * next-auth/react's own signIn() request contract (see node_modules/
 * next-auth/react.js) by hand, pointed at /api/admin/auth/* — the two auth
 * systems stay fully independent client-side too, not just server-side.
 */
export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "submitting">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setState("submitting");
    setError(null);

    try {
      const { csrfToken } = (await fetch("/api/admin/auth/csrf").then((r) => r.json())) as { csrfToken: string };
      const response = await fetch("/api/admin/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Auth-Return-Redirect": "1" },
        body: new URLSearchParams({ email, password, csrfToken, callbackUrl }),
      });
      const data = (await response.json()) as { url: string };
      const resultUrl = new URL(data.url);
      const errorCode = resultUrl.searchParams.get("code") ?? resultUrl.searchParams.get("error");

      if (errorCode === "account_locked") {
        setError("Too many failed attempts. This account is temporarily locked — please try again later.");
        setState("idle");
        return;
      }
      if (errorCode) {
        setError("Incorrect email or password.");
        setState("idle");
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setState("idle");
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-4">
      <div>
        <Label htmlFor="admin-login-email">Email address</Label>
        <Input id="admin-login-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>

      <div>
        <Label htmlFor="admin-login-password">Password</Label>
        <Input
          id="admin-login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      {error && (
        <p role="alert" className="text-small text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={state === "submitting"} className="sm:self-start">
        {state === "submitting" ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
