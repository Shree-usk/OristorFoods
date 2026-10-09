import { prisma } from "@/lib/db";

/** The only place InstagramIntegrationSetting/InstagramPost are queried/mutated. Singleton setting row upserted by id: "global" — same pattern as CompanySetting etc. (system-settings.repository.ts). */

export function getIntegrationSetting() {
  return prisma.instagramIntegrationSetting.findUnique({ where: { id: "global" } });
}

export interface InstagramIntegrationSettingInput {
  businessAccountId?: string | null;
  accessToken?: string | null;
  tokenExpiresAt?: Date | null;
  lastSyncedAt?: Date | null;
  lastSyncError?: string | null;
}

export function upsertIntegrationSetting(input: InstagramIntegrationSettingInput) {
  return prisma.instagramIntegrationSetting.upsert({
    where: { id: "global" },
    create: { id: "global", ...input },
    update: input,
  });
}

export function listRecentPosts(limit: number) {
  return prisma.instagramPost.findMany({ orderBy: { postedAt: "desc" }, take: limit });
}

export interface InstagramPostUpsertInput {
  id: string;
  imageUrl: string;
  permalink: string;
  caption: string | null;
  postedAt: Date;
}

/** No-ops on an empty list — a transient empty API response must never wipe an otherwise-healthy cached gallery. */
export async function replaceAllPosts(posts: InstagramPostUpsertInput[]): Promise<void> {
  if (posts.length === 0) return;
  const ids = posts.map((post) => post.id);
  await prisma.$transaction([
    ...posts.map((post) =>
      prisma.instagramPost.upsert({
        where: { id: post.id },
        create: post,
        update: { imageUrl: post.imageUrl, permalink: post.permalink, caption: post.caption, postedAt: post.postedAt, syncedAt: new Date() },
      }),
    ),
    prisma.instagramPost.deleteMany({ where: { id: { notIn: ids } } }),
  ]);
}
