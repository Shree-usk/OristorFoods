"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { connectInstagram, disconnectInstagram, fetchInstagramIntegrationStatus, syncInstagramNow } from "@/lib/api/admin-system-settings-client";

function formatDate(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

/** Powers the storefront's "Follow @oristorfoods" homepage section. Connecting requires a short-lived access token pasted from Graph API Explorer — see the admin's own setup notes for the Meta app / Facebook Page prerequisites this depends on. */
export function IntegrationsSettingsPanel() {
  const queryClient = useQueryClient();
  const [accessToken, setAccessToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const { data: status, isLoading } = useQuery({ queryKey: ["admin-settings-instagram"], queryFn: fetchInstagramIntegrationStatus });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-settings-instagram"] });
  }

  async function handleConnect() {
    setError(null);
    setNotice(null);
    setIsBusy(true);
    try {
      const result = await connectInstagram(accessToken);
      setAccessToken("");
      setNotice(`Connected to "${result.connectedPageName}" and synced the latest posts.`);
      invalidate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect Instagram.");
    } finally {
      setIsBusy(false);
    }
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
        <p className="text-small font-medium text-charcoal">Instagram (@oristorfoods)</p>
        <p className="mt-1 text-small text-charcoal/70">
          Feeds the homepage&apos;s &quot;Follow @oristorfoods&quot; gallery from the connected Instagram Business account. Requires a Facebook Page
          linked to that account and a Meta app with the Instagram Graph API product enabled.
        </p>
      </div>

      {error && <p className="text-small text-destructive">{error}</p>}
      {notice && <p className="text-small text-green-700">{notice}</p>}

      {status?.connected ? (
        <div className="rounded-md border border-input p-4">
          <p className="text-small text-charcoal">
            <span className="font-medium">Status:</span> Connected
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
          <div className="mt-3">
            <Label htmlFor="instagram-access-token">Access token</Label>
            <Input
              id="instagram-access-token"
              type="password"
              placeholder="Paste the short-lived token from Graph API Explorer"
              value={accessToken}
              onChange={(event) => setAccessToken(event.target.value)}
              className="mt-1"
            />
            <p className="mt-1 text-caption text-charcoal/60">
              Only needed once — it&apos;s exchanged for a long-lived token and stored securely; you won&apos;t need to paste it again unless you
              disconnect.
            </p>
            <Button type="button" size="sm" className="mt-2" onClick={handleConnect} disabled={isBusy || !accessToken.trim()}>
              Connect
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
