"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface ReferralLinkCardProps {
  link: string;
  referrerBonusPoints: number | null;
}

/** STORY-035. Copy-to-clipboard always available; native share (Web Share API) only where supported, per the AC. */
export function ReferralLinkCard({ link, referrerBonusPoints }: ReferralLinkCardProps) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied (e.g. insecure context) — the input field itself is still selectable/copyable manually.
    }
  }

  async function handleShare() {
    try {
      await navigator.share({ title: "Join me on Oristor", text: "Shop authentic Sri Lankan food with Oristor — use my link to get started.", url: link });
    } catch {
      // User cancelled the share sheet — not an error.
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your referral link</CardTitle>
      </CardHeader>
      <CardContent>
        {referrerBonusPoints ? (
          <p className="text-small text-charcoal/70">Share your link — earn {referrerBonusPoints.toLocaleString()} points for every friend who makes a qualifying purchase.</p>
        ) : (
          <p className="text-small text-charcoal/70">Share your link with friends and family.</p>
        )}

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Input readOnly value={link} onFocus={(event) => event.currentTarget.select()} className="flex-1" aria-label="Your referral link" />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy"}
            </Button>
            {canShare && (
              <Button type="button" onClick={handleShare}>
                Share
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
