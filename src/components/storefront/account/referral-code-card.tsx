"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";

interface ReferralCodeResponse {
  code: string;
  link: string;
}

async function fetchReferralCode(): Promise<ReferralCodeResponse> {
  const response = await fetch("/api/referral/code", { credentials: "include" });
  if (!response.ok) throw new Error("Failed to load your referral link");
  return response.json() as Promise<ReferralCodeResponse>;
}

/**
 * Referral code + shareable-link display (STORY-031). This is the base
 * component only — embedding it into a full account dashboard (referral
 * list/progress, share buttons beyond copy-link) is STORY-035's job. Not
 * rendered on any page yet; import it from wherever that dashboard lands.
 */
export function ReferralCodeCard() {
  const { data, isPending, isError } = useQuery({ queryKey: ["referral-code"], queryFn: fetchReferralCode });
  const [copied, setCopied] = useState(false);

  if (isPending) return <p className="text-small text-charcoal/70">Loading your referral link…</p>;
  if (isError || !data) return <p className="text-small text-destructive">Couldn&apos;t load your referral link.</p>;

  const fullLink = typeof window !== "undefined" ? `${window.location.origin}${data.link}` : data.link;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fullLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied — the link is still visible to copy manually.
    }
  }

  return (
    <div className="rounded-lg border border-input p-4">
      <p className="text-small font-semibold text-charcoal">Your referral link</p>
      <p className="mt-1 break-all font-number text-small text-charcoal/70">{fullLink}</p>
      <Button type="button" variant="outline" size="sm" className="mt-3" onClick={handleCopy}>
        {copied ? "Copied!" : "Copy link"}
      </Button>
    </div>
  );
}
