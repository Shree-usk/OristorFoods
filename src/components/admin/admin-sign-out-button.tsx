"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/** STORY-038. Same fetch-based approach as admin-login-form.tsx — replicates next-auth/react's signOut() contract by hand, pointed at /api/admin/auth/signout. */
export function AdminSignOutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    const { csrfToken } = (await fetch("/api/admin/auth/csrf").then((r) => r.json())) as { csrfToken: string };
    await fetch("/api/admin/auth/signout", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Auth-Return-Redirect": "1" },
      body: new URLSearchParams({ csrfToken }),
    });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleSignOut} disabled={isSigningOut}>
      {isSigningOut ? "Signing out…" : "Sign out"}
    </Button>
  );
}
