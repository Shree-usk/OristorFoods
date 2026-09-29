import type { TierProgress } from "@/services/customer-rewards-dashboard.service";

/** STORY-035. Presentational only — `tierProgress` comes from customer-rewards-dashboard.service.ts::computeTierProgress. */
export function TierProgressBar({ tierProgress }: { tierProgress: TierProgress }) {
  if (!tierProgress.nextTier || tierProgress.progressPercent === null) {
    return tierProgress.currentTier ? <p className="text-small text-charcoal/70">You&apos;ve reached our top tier — thank you for being a loyal customer.</p> : null;
  }

  return (
    <div>
      <div className="flex items-center justify-between text-small text-charcoal/70">
        <span>{tierProgress.currentTier?.name ?? "Getting started"}</span>
        <span>{tierProgress.nextTier.name}</span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(tierProgress.progressPercent)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-chilli transition-all" style={{ width: `${tierProgress.progressPercent}%` }} />
      </div>
      <p className="mt-1 text-caption text-charcoal/70">{tierProgress.pointsToNextTier?.toLocaleString()} points to {tierProgress.nextTier.name}</p>
    </div>
  );
}
