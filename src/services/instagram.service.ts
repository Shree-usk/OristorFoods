import * as instagramRepository from "@/repositories/instagram.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { InstagramConnectFailedError, InstagramNotConnectedError, InstagramSyncFailedError } from "@/services/instagram.errors";
import { getActiveStorageProvider } from "@/services/media.service";
import { requirePermission } from "@/services/permission.service";

/**
 * Gated behind SystemSettings (View/Edit) like every other integration in
 * this area — Instagram never got its own AdminModule enum value since it's
 * one settings panel, not a standalone admin section.
 *
 * Uses the Instagram API **with Instagram Login** (Business Login for
 * Instagram) — not the older Facebook-Login-based Page Access Token path
 * this file originally shipped with. That first version silently resolved
 * whichever Facebook Page the admin's Facebook account happened to manage,
 * which turned out to be an old, unrelated Page/Instagram account — the
 * real @oristorfoods-equivalent account here isn't linked to any Facebook
 * Page the admin manages, only reachable by logging into Instagram
 * directly. Business Login sidesteps Facebook Pages entirely: the admin
 * authorizes directly as the Instagram account, via Instagram's own OAuth
 * dialog, and every token from here on is scoped straight to that account.
 */
const IG_OAUTH_AUTHORIZE_URL = "https://www.instagram.com/oauth/authorize";
const IG_SHORT_LIVED_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const IG_GRAPH_BASE = "https://graph.instagram.com";
const IG_SCOPE = "instagram_business_basic";
const POSTS_PER_SYNC = 12;
// Refresh once within this window of expiry — ig_refresh_token requires the
// token be at least 24h old, so this must stay well clear of that floor.
const TOKEN_REFRESH_WINDOW_MS = 10 * 24 * 60 * 60 * 1000;

interface RawMedia {
  id: string;
  caption?: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url?: string;
  thumbnail_url?: string;
  permalink: string;
  timestamp: string;
}

interface GraphApiErrorBody {
  error_message?: string;
  error?: { message?: string } | string;
}

function errorMessageFrom(body: GraphApiErrorBody, fallback: string): string {
  if (body.error_message) return body.error_message;
  if (typeof body.error === "string") return body.error;
  if (body.error?.message) return body.error.message;
  return fallback;
}

function requireAppCredentials(): { appId: string; appSecret: string } {
  const appId = process.env.INSTAGRAM_APP_ID;
  const appSecret = process.env.INSTAGRAM_APP_SECRET;
  if (!appId || !appSecret) {
    throw new InstagramConnectFailedError("INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET must be set in the environment before Instagram can be connected.");
  }
  return { appId, appSecret };
}

function redirectUri(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) throw new InstagramConnectFailedError("NEXT_PUBLIC_SITE_URL must be set for the Instagram OAuth redirect.");
  return `${siteUrl}/api/admin/settings/integrations/instagram/oauth/callback`;
}

/** The URL the admin's browser is sent to; Instagram redirects back to our own callback route with ?code=...&state=... */
export function buildAuthorizeUrl(state: string): string {
  const { appId } = requireAppCredentials();
  const url = new URL(IG_OAUTH_AUTHORIZE_URL);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", IG_SCOPE);
  url.searchParams.set("state", state);
  return url.toString();
}

async function exchangeCodeForShortLivedToken(code: string): Promise<string> {
  const { appId, appSecret } = requireAppCredentials();
  const form = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri(),
    code,
  });

  const response = await fetch(IG_SHORT_LIVED_TOKEN_URL, { method: "POST", body: form });
  const body = (await response.json().catch(() => ({}))) as GraphApiErrorBody & { access_token?: string };
  if (!response.ok || !body.access_token) {
    throw new InstagramConnectFailedError(errorMessageFrom(body, "Instagram rejected the authorization code."));
  }
  return body.access_token;
}

async function exchangeForLongLivedToken(shortLivedToken: string): Promise<{ accessToken: string; expiresInSeconds: number }> {
  const { appSecret } = requireAppCredentials();
  const url = new URL(`${IG_GRAPH_BASE}/access_token`);
  url.searchParams.set("grant_type", "ig_exchange_token");
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("access_token", shortLivedToken);

  const response = await fetch(url);
  const body = (await response.json().catch(() => ({}))) as GraphApiErrorBody & { access_token?: string; expires_in?: number };
  if (!response.ok || !body.access_token) {
    throw new InstagramConnectFailedError(errorMessageFrom(body, "Could not exchange for a long-lived Instagram token."));
  }
  return { accessToken: body.access_token, expiresInSeconds: body.expires_in ?? 60 * 24 * 60 * 60 };
}

async function refreshLongLivedToken(currentToken: string): Promise<{ accessToken: string; expiresInSeconds: number } | null> {
  const url = new URL(`${IG_GRAPH_BASE}/refresh_access_token`);
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", currentToken);

  const response = await fetch(url);
  const body = (await response.json().catch(() => ({}))) as GraphApiErrorBody & { access_token?: string; expires_in?: number };
  if (!response.ok || !body.access_token) return null;
  return { accessToken: body.access_token, expiresInSeconds: body.expires_in ?? 60 * 24 * 60 * 60 };
}

async function fetchAccountIdentity(accessToken: string): Promise<{ userId: string; username: string }> {
  const url = new URL(`${IG_GRAPH_BASE}/me`);
  url.searchParams.set("fields", "user_id,username");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url);
  const body = (await response.json().catch(() => ({}))) as GraphApiErrorBody & { user_id?: string; username?: string };
  if (!response.ok || !body.user_id) {
    throw new InstagramConnectFailedError(errorMessageFrom(body, "Could not read the connected Instagram account's identity."));
  }
  return { userId: body.user_id, username: body.username ?? body.user_id };
}

async function fetchRecentMedia(userId: string, accessToken: string): Promise<RawMedia[]> {
  const url = new URL(`${IG_GRAPH_BASE}/${userId}/media`);
  url.searchParams.set("fields", "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp");
  url.searchParams.set("limit", String(POSTS_PER_SYNC));
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url);
  const body = (await response.json().catch(() => ({}))) as GraphApiErrorBody & { data?: RawMedia[] };
  if (!response.ok) {
    throw new Error(errorMessageFrom(body, `Instagram API returned ${response.status}.`));
  }
  return body.data ?? [];
}

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Each media item downloads independently — one broken image (dead CDN link, unsupported content type) is skipped rather than failing the whole sync, same tolerance uploadAssets() gives a batch of admin uploads. */
async function downloadMediaImage(media: RawMedia): Promise<instagramRepository.InstagramPostUpsertInput | null> {
  const sourceUrl = media.media_type === "VIDEO" ? media.thumbnail_url : media.media_url;
  if (!sourceUrl) return null;

  const response = await fetch(sourceUrl);
  if (!response.ok) return null;

  const buffer = Buffer.from(await response.arrayBuffer());
  const extension = EXTENSION_BY_CONTENT_TYPE[response.headers.get("content-type") ?? ""] ?? "jpg";
  const { url } = await getActiveStorageProvider().upload({ buffer, safeFilename: `instagram-${media.id}.${extension}` });

  return {
    id: media.id,
    imageUrl: url,
    permalink: media.permalink,
    caption: media.caption ? media.caption.slice(0, 2200) : null,
    postedAt: new Date(media.timestamp),
  };
}

async function performSync(): Promise<void> {
  const setting = await instagramRepository.getIntegrationSetting();
  if (!setting?.accessToken || !setting.businessAccountId) throw new InstagramNotConnectedError();
  const businessAccountId = setting.businessAccountId;
  let accessToken = setting.accessToken;

  try {
    // Opportunistically refresh a token nearing expiry so the scheduled
    // cron sync keeps working for months without a manual reconnect.
    if (setting.tokenExpiresAt && setting.tokenExpiresAt.getTime() - Date.now() < TOKEN_REFRESH_WINDOW_MS) {
      const refreshed = await refreshLongLivedToken(accessToken);
      if (refreshed) {
        accessToken = refreshed.accessToken;
        await instagramRepository.upsertIntegrationSetting({
          accessToken: refreshed.accessToken,
          tokenExpiresAt: new Date(Date.now() + refreshed.expiresInSeconds * 1000),
        });
      }
    }

    const media = await fetchRecentMedia(businessAccountId, accessToken);
    const downloaded = await Promise.all(media.map(downloadMediaImage));
    const posts = downloaded.filter((post): post is instagramRepository.InstagramPostUpsertInput => post !== null);
    await instagramRepository.replaceAllPosts(posts);
    await instagramRepository.upsertIntegrationSetting({ lastSyncedAt: new Date(), lastSyncError: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error.";
    await instagramRepository.upsertIntegrationSetting({ lastSyncError: message });
    throw new InstagramSyncFailedError(message);
  }
}

export interface InstagramIntegrationStatus {
  connected: boolean;
  username: string | null;
  tokenExpiresAt: Date | null;
  lastSyncedAt: Date | null;
  lastSyncError: string | null;
}

/** Never returns the access token itself — there's no legitimate reason for it to round-trip back to the browser once stored. */
export async function getIntegrationStatus(adminUserId: string): Promise<InstagramIntegrationStatus> {
  await requirePermission(adminUserId, "SystemSettings", "View");
  const setting = await instagramRepository.getIntegrationSetting();
  return {
    connected: Boolean(setting?.accessToken && setting.businessAccountId),
    username: setting?.username ?? null,
    tokenExpiresAt: setting?.tokenExpiresAt ?? null,
    lastSyncedAt: setting?.lastSyncedAt ?? null,
    lastSyncError: setting?.lastSyncError ?? null,
  };
}

/** Called by the OAuth start route — requires an authenticated admin with Edit access before handing back a URL that will ultimately store a new connection. */
export async function getAuthorizeUrl(adminUserId: string, state: string): Promise<string> {
  await requirePermission(adminUserId, "SystemSettings", "Edit");
  return buildAuthorizeUrl(state);
}

/**
 * The OAuth callback: exchanges the authorization code for a short-lived
 * token, then a long-lived one, resolves the connected account's own
 * identity (so the admin panel can show *which* account connected — this
 * is exactly the check that would have caught the wrong-account mixup
 * immediately instead of showing stale photos), stores it, and runs an
 * immediate sync so a broken connection fails loudly here rather than
 * silently on the homepage.
 */
export async function handleOAuthCallback(adminUserId: string, code: string): Promise<{ username: string }> {
  await requirePermission(adminUserId, "SystemSettings", "Edit");

  const shortLivedToken = await exchangeCodeForShortLivedToken(code);
  const { accessToken, expiresInSeconds } = await exchangeForLongLivedToken(shortLivedToken);
  const { userId, username } = await fetchAccountIdentity(accessToken);

  await instagramRepository.upsertIntegrationSetting({
    businessAccountId: userId,
    username,
    accessToken,
    tokenExpiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    lastSyncedAt: null,
    lastSyncError: null,
  });
  await writeAuditLog({ actorId: adminUserId, action: "instagram_connected", module: "SystemSettings", targetType: "InstagramIntegrationSetting", targetId: "global" });

  await performSync();
  return { username };
}

export async function disconnect(adminUserId: string): Promise<void> {
  await requirePermission(adminUserId, "SystemSettings", "Edit");
  await instagramRepository.upsertIntegrationSetting({ businessAccountId: null, username: null, accessToken: null, tokenExpiresAt: null, lastSyncedAt: null, lastSyncError: null });
  await writeAuditLog({ actorId: adminUserId, action: "instagram_disconnected", module: "SystemSettings", targetType: "InstagramIntegrationSetting", targetId: "global" });
}

export async function syncNow(adminUserId: string): Promise<void> {
  await requirePermission(adminUserId, "SystemSettings", "Edit");
  await performSync();
  await writeAuditLog({ actorId: adminUserId, action: "instagram_synced", module: "SystemSettings", targetType: "InstagramIntegrationSetting", targetId: "global" });
}

/** No permission gate — called only by the cron-secret-protected route (api/cron/instagram-sync), which has no admin session to check. */
export async function runScheduledSync(): Promise<void> {
  await performSync();
}

export async function getRecentPostsForStorefront(limit: number) {
  return instagramRepository.listRecentPosts(limit);
}
