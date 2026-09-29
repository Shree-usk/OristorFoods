"use client";

import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { toastManager } from "@/lib/toast";

/** STORY-034. Invalidates every session, including this one — see security.service.ts's header comment. */
export function LogoutAllDevicesButton() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleClick() {
    setIsSubmitting(true);
    const response = await fetch("/api/account/security/logout-all", { method: "POST", credentials: "include" });
    setIsSubmitting(false);

    if (!response.ok) {
      toastManager.add({ title: "Something went wrong", description: "Please try again.", type: "error" });
      return;
    }

    toastManager.add({ title: "Signed out of all devices" });
    await signOut({ redirect: false });
    router.push("/");
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={isSubmitting}>
      {isSubmitting ? "Signing out…" : "Log out of all devices"}
    </Button>
  );
}
