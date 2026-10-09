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
 * Bump this when Meta deprecates the pinned version (they give ~2 years'
 * notice); nothing else here is version-specific.
 */
const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";
const POSTS_PER_SYNC = 12;

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
  error?: { message?: string };
}

async function exchangeForLongLivedUserToken(shortLivedToken: string): Promise<{ accessToken: string; expiresInSeconds: number | null }> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new InstagramConnectFailedError("META_APP_ID and META_APP_SECRET must be set in the environment before Instagram can be connected.");
  }

  const url = new URL(`${GRAPH_API_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", shortLivedToken);

  const response = await fetch(url);
  const body = (await response.json().catch(() => ({}))) as GraphApiErrorBody & { access_token?: string; expires_in?: number };
  if (!response.ok || !body.access_token) {
    throw new InstagramConnectFailedError(body.error?.message ?? "Meta rejected the access token exchange.");
  }
  return { accessToken: body.access_token, expiresInSeconds: typeof body.expires_in === "number" ? body.expires_in : null };
}

/** The admin pastes a User token; what we actually need to call the Media endpoint is the Page Access Token of whichever Facebook Page has the Instagram Business account linked. */
async function resolveLinkedInstagramAccount(longLivedUserToken: string): Promise<{ pageName: string; businessAccountId: string; pageAccessToken: string }> {
  const url = new URL(`${GRAPH_API_BASE}/me/accounts`);
  url.searchParams.set("fields", "name,access_token,instagram_business_account");
  url.searchParams.set("access_token", longLivedUserToken);

  const response = await fetch(url);
  const body = (await response.json().catch(() => ({}))) as GraphApiErrorBody & {
    data?: { name: string; access_token: string; instagram_business_account?: { id: string } }[];
  };
  if (!response.ok) {
    throw new InstagramConnectFailedError(body.error?.message ?? "Could not list Facebook Pages for this token.");
  }

  const linked = (body.data ?? []).find((page) => page.instagram_business_account?.id);
  if (!linked?.instagram_business_account) {
    throw new InstagramConnectFailedError(
      "No Facebook Page reachable with this token has an Instagram Business account linked. Link the @oristorfoods Instagram account to the Oristor Facebook Page first.",
    );
  }
  return { pageName: linked.name, businessAccountId: linked.instagram_business_account.id, pageAccessToken: linked.access_token };
}

async function fetchRecentMedia(businessAccountId: string, accessToken: string): Promise<RawMedia[]> {
  const url = new URL(`${GRAPH_API_BASE}/${businessAccountId}/media`);
  url.searchParams.set("fields", "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp");
  url.searchParams.set("limit", String(POSTS_PER_SYNC));
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url);
  const body = (await response.json().catch(() => ({}))) as GraphApiErrorBody & { data?: RawMedia[] };
  if (!response.ok) {
    throw new Error(body.error?.message ?? `Instagram API returned ${response.status}.`);
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

  try {
    const media = await fetchRecentMedia(setting.businessAccountId, setting.accessToken);
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
  businessAccountId: string | null;
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
    businessAccountId: setting?.businessAccountId ?? null,
    tokenExpiresAt: setting?.tokenExpiresAt ?? null,
    lastSyncedAt: setting?.lastSyncedAt ?? null,
    lastSyncError: setting?.lastSyncError ?? null,
  };
}

/**
 * Takes the short-lived User token the admin pastes from Graph API
 * Explorer, exchanges it for a long-lived one, resolves the linked
 * Instagram Business account's Page Access Token, stores that, and runs
 * an immediate sync so a broken connection fails loudly here rather than
 * silently on the homepage.
 */
export async function connect(adminUserId: string, shortLivedAccessToken: string): Promise<{ connectedPageName: string }> {
  await requirePermission(adminUserId, "SystemSettings", "Edit");

  const { accessToken: longLivedUserToken, expiresInSeconds } = await exchangeForLongLivedUserToken(shortLivedAccessToken);
  const { pageName, businessAccountId, pageAccessToken } = await resolveLinkedInstagramAccount(longLivedUserToken);

  await instagramRepository.upsertIntegrationSetting({
    businessAccountId,
    accessToken: pageAccessToken,
    // Informational only — Page tokens derived this way are long-lived in
    // practice and Meta doesn't guarantee a hard expiry for them, unlike
    // the short-lived token exchanged above. Treat this as "reconnect if
    // sync starts failing," not a hard deadline.
    tokenExpiresAt: expiresInSeconds ? new Date(Date.now() + expiresInSeconds * 1000) : null,
    lastSyncedAt: null,
    lastSyncError: null,
  });
  await writeAuditLog({ actorId: adminUserId, action: "instagram_connected", module: "SystemSettings", targetType: "InstagramIntegrationSetting", targetId: "global" });

  await performSync();
  return { connectedPageName: pageName };
}

export async function disconnect(adminUserId: string): Promise<void> {
  await requirePermission(adminUserId, "SystemSettings", "Edit");
  await instagramRepository.upsertIntegrationSetting({ businessAccountId: null, accessToken: null, tokenExpiresAt: null, lastSyncedAt: null, lastSyncError: null });
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
