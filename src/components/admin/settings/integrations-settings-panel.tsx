"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { disconnectInstagram, fetchInstagramIntegrationStatus, syncInstagramNow } from "@/lib/api/admin-system-settings-client";

function formatDate(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

/**
 * Powers the storefront's "Follow @oristorfoods" homepage section. Uses the
 * Instagram API with Instagram Login (Business Login for Instagram) — the
 * admin clicks through to Instagram's own OAuth dialog and authorizes
 * directly as the Instagram account, no Facebook Page involved. An earlier
 * version of this panel used a Facebook-Login-based flow (paste a token
 * from Graph API Explorer) that silently resolved the wrong, unrelated
 * account — this one shows the connected @handle plainly so that's
 * immediately obvious instead of only showing up as stale homepage photos.
 */
export function IntegrationsSettingsPanel() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(searchParams.get("instagram") === "error" ? (searchParams.get("message") ?? "Connection failed.") : null);
  const [notice, setNotice] = useState<string | null>(
    searchParams.get("instagram") === "connected" ? `Connected to @${searchParams.get("username")} and synced the latest posts.` : null,
  );
  const [isBusy, setIsBusy] = useState(false);

  const { data: status, isLoading } = useQuery({ queryKey: ["admin-settings-instagram"], queryFn: fetchInstagramIntegrationStatus });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-settings-instagram"] });
  }

  async function handleSync() {
    setError(null);
    setNotice(null);
    setIsBusy(true);
    try {
      await syncInstagramNow();
      setNotice("Synced the latest posts.");
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync Instagram.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDisconnect() {
    setError(null);
    setNotice(null);
    setIsBusy(true);
    try {
      await disconnectInstagram();
      setNotice("Disconnected. The homepage section will show its placeholder images until reconnected.");
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect Instagram.");
    } finally {
      setIsBusy(false);
    }
  }

  if (isLoading) return <p className="text-small text-charcoal/70">Loading…</p>;

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <p className="text-small font-medium text-charcoal">Instagram</p>
        <p className="mt-1 text-small text-charcoal/70">Feeds the homepage&apos;s &quot;Follow @oristorfoods&quot; gallery from the connected Instagram account.</p>
      </div>

      {error && <p className="text-small text-destructive">{error}</p>}
      {notice && <p className="text-small text-green-700">{notice}</p>}

      {status?.connected ? (
        <div className="rounded-md border border-input p-4">
          <p className="text-small text-charcoal">
            <span className="font-medium">Status:</span> Connected to <span className="font-medium">@{status.username}</span>
          </p>
          <p className="mt-1 text-small text-charcoal/70">Last synced: {formatDate(status.lastSyncedAt)}</p>
          {status.lastSyncError && <p className="mt-1 text-small text-destructive">Last sync error: {status.lastSyncError}</p>}
          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" onClick={handleSync} disabled={isBusy}>
              Sync now
            </Button>
            <Button type="button" size="sm" variant="destructive" onClick={handleDisconnect} disabled={isBusy}>
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-input p-4">
          <p className="text-small text-charcoal">
            <span className="font-medium">Status:</span> Not connected
          </p>
          <p className="mt-2 text-caption text-charcoal/60">
            You&apos;ll be sent to Instagram to log in and approve access — make sure you&apos;re logged into the correct Instagram account in this
            browser first.
          </p>
          <Button className="mt-3" size="sm" nativeButton={false} render={<a href="/api/admin/settings/integrations/instagram/oauth/start" />}>
            Connect with Instagram
          </Button>
        </div>
      )}
    </div>
  );
}
