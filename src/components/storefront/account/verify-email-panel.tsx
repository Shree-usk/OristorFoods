"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type ConfirmResult = { status: "success" } | { status: "error"; message: string };

export function VerifyEmailPanel() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId");
  const token = searchParams.get("token");
  const hasParams = Boolean(userId && token);
  const [result, setResult] = useState<ConfirmResult | null>(null);
  const requested = useRef(false);

  useEffect(() => {
    // Missing params is a pure render-time branch below — nothing to fetch, so nothing to synchronize here.
    if (!hasParams || requested.current) return;
    requested.current = true;

    fetch("/api/account/profile/email/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, token }),
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: string } | null;
          setResult({ status: "error", message: body?.error ?? "This confirmation link is invalid or has expired." });
          return;
        }
        setResult({ status: "success" });
      })
      .catch(() => {
        setResult({ status: "error", message: "Something went wrong. Please try again." });
      });
  }, [hasParams, userId, token]);

  if (!hasParams) {
    return (
      <p role="alert" className="mt-6 text-body text-destructive">
        This confirmation link is missing required information.
      </p>
    );
  }

  if (!result) return <p className="mt-6 text-body text-charcoal">Confirming your new email address…</p>;

  if (result.status === "error") {
    return (
      <p role="alert" className="mt-6 text-body text-destructive">
        {result.message}
      </p>
    );
  }

  return (
    <div className="mt-6">
      <p role="status" className="text-body text-charcoal">
        Your email address has been updated. Please sign in again.
      </p>
      <Link href="/account/login" className="mt-4 inline-block text-small text-chilli underline-offset-2 hover:underline">
        Go to sign in
      </Link>
    </div>
  );
}
