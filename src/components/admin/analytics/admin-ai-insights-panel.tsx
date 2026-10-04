"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { fetchInsightsSummary, recomputeInsightsAdmin } from "@/lib/api/admin-ai-insights-client";

/**
 * STORY-064. Every narrative here is generated from real computed
 * trend/anomaly data only (business-insights.service.ts) — no
 * unverifiable black-box claims (AC #6). No cron exists in this
 * codebase; "Recompute Now" is the real, callable trigger, same
 * pattern as the Scheduled Reports section above it.
 */
export function AdminAiInsightsPanel() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [isRecomputing, setIsRecomputing] = useState(false);

  const { data: summary } = useQuery({ queryKey: ["admin-ai-insights-summary"], queryFn: fetchInsightsSummary });

  async function handleRecompute() {
    setActionError(null);
    setIsRecomputing(true);
    try {
      const result = await recomputeInsightsAdmin();
      if (!result.generated) {
        setActionError("The AI provider couldn't generate a fresh summary right now — please try again shortly.");
      }
      queryClient.invalidateQueries({ queryKey: ["admin-ai-insights-summary"] });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to recompute insights.");
    } finally {
      setIsRecomputing(false);
    }
  }

  const lastUpdated = summary?.trend?.generatedAt ?? summary?.anomaly?.generatedAt ?? null;

  return (
    <div className="mt-8 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-h5 font-heading text-charcoal">AI Insights</h3>
          <p className="text-small text-charcoal/70">{lastUpdated ? `Last updated ${new Date(lastUpdated).toLocaleString()}` : "Not yet computed."}</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={handleRecompute} disabled={isRecomputing}>
          {isRecomputing ? "Recomputing…" : "Recompute Now"}
        </Button>
      </div>

      {actionError && <p className="mt-2 text-small text-destructive">{actionError}</p>}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="text-small font-semibold text-charcoal">Trends</h4>
          <p className="mt-1 text-small text-charcoal/80">{summary?.trend?.narrativeText ?? "No trend summary yet — use Recompute Now."}</p>
        </div>
        <div>
          <h4 className="text-small font-semibold text-charcoal">Anomalies</h4>
          <p className="mt-1 text-small text-charcoal/80">{summary?.anomaly?.narrativeText ?? "No anomaly summary yet — use Recompute Now."}</p>
        </div>
      </div>
    </div>
  );
}
