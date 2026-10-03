"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInvite } from "@/lib/api/admin-users-client";

/** STORY-057. Outside the (admin) route group — see src/app/admin/accept-invite/page.tsx's own comment. Mirrors reset-password-form.tsx's ?token/?email read + submit shape. */
export function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const token = searchParams.get("token") ?? "";

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!email || !token) {
    return <p className="mt-6 text-body text-destructive">This invite link is missing required information. Ask a Super Administrator to resend it.</p>;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await acceptInvite({ email, token, name, password });
      router.push("/admin/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept the invite.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      <div>
        <Label htmlFor="accept-invite-name">Your name</Label>
        <Input id="accept-invite-name" value={name} onChange={(event) => setName(event.target.value)} required />
      </div>
      <div>
        <Label htmlFor="accept-invite-password">Set a password</Label>
        <Input id="accept-invite-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
      </div>
      {error && (
        <p role="alert" className="text-small text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" disabled={submitting} className="sm:self-start">
        {submitting ? "Setting up your account…" : "Join the admin console"}
      </Button>
    </form>
  );
}
