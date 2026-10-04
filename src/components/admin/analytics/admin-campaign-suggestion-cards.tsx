"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { exportChurnTierToSegmentAdmin, fetchInsightsSummary } from "@/lib/api/admin-ai-insights-client";

/**
 * STORY-064. Human-reviewable only — never auto-launched (AC #4). Each
 * card's productIds/targetChurnTier are guardrail-validated real data
 * (business-insights.service.ts), not freeform LLM text. "Send to
 * Marketing" creates the real churn-tier segment (when targetChurnTier
 * is set) via the same exportChurnTierToSegment the Churn Risk table
 * uses, then hands off to the existing campaign builder — no new
 * pre-fill plumbing exists there, so this only links, it never submits
 * anything on the admin's behalf.
 */
export function AdminCampaignSuggestionCards() {
  const { data: summary } = useQuery({ queryKey: ["admin-ai-insights-summary"], queryFn: fetchInsightsSummary });
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);

  async function handleSend(id: string, targetChurnTier: "Low" | "Medium" | "High" | null) {
    setActionError(null);
    setSendingId(id);
    try {
      if (targetChurnTier) {
        const segment = await exportChurnTierToSegmentAdmin(targetChurnTier);
        setActionMessage((prev) => ({ ...prev, [id]: `Segment "${segment.name}" is ready — pick it as the audience in the Marketing Console.` }));
      } else {
        setActionMessage((prev) => ({ ...prev, [id]: "Open the Marketing Console to build a campaign using the products below." }));
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to prepare the campaign hand-off.");
    } finally {
      setSendingId(null);
    }
  }

  const suggestions = summary?.campaignSuggestions ?? [];

  return (
    <div className="mt-8">
      <h3 className="text-h5 font-heading text-charcoal">Campaign Suggestions</h3>
      <p className="mt-1 text-small text-charcoal/70">Human-reviewable ideas only — nothing here is ever launched automatically.</p>

      {actionError && <p className="mt-2 text-small text-destructive">{actionError}</p>}

      {suggestions.length === 0 && <p className="mt-2 text-small text-charcoal/70">No campaign suggestions yet — use Recompute Now above.</p>}

      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        {suggestions.map((suggestion) => {
          const payload = suggestion.structuredPayload;
          if (!payload) return null;
          return (
            <div key={suggestion.id} className="rounded-lg border border-border p-4">
              <h4 className="text-small font-semibold text-charcoal">{payload.title}</h4>
              <p className="mt-1 text-small text-charcoal/80">{payload.rationale}</p>
              {payload.suggestedProductIds.length > 0 && (
                <ul className="mt-2 space-y-1 text-small">
                  {payload.suggestedProductIds.map((productId) => (
                    <li key={productId}>
                      <Link href={`/admin/products/${productId}`} className="text-primary hover:underline">
                        View product
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex items-center gap-2">
                <Button type="button" size="sm" onClick={() => handleSend(suggestion.id, payload.targetChurnTier)} disabled={sendingId === suggestion.id}>
                  {sendingId === suggestion.id ? "Preparing…" : "Send to Marketing Console"}
                </Button>
                <Link href="/admin/marketing/email-sms" className="text-small text-primary hover:underline">
                  Open Marketing Console
                </Link>
              </div>
              {actionMessage[suggestion.id] && <p className="mt-2 text-small text-emerald-700">{actionMessage[suggestion.id]}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
