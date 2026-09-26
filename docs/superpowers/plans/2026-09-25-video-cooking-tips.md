# STORY-019 Video Recipes & Cooking Tips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lazy-loaded video player (YouTube/Vimeo/self-hosted) to the Recipe Detail Page, a "Has Video" filter on the Recipe Centre, and a new standalone `CookingTip` content type with a `/recipes/cooking-tips` listing (topic-filterable) and `/recipes/cooking-tips/[slug]` detail page.

**Architecture:** `Recipe` gains flat, nullable video fields (mirrors STORY-018's nutrition fields). A new pure `normalizeVideoUrl()` helper turns a pasted share URL into `{provider, embedId, url}`, shared by the Zod schema and the `VideoPlayer` Client Component. `VideoPlayer` is a click-to-play facade for YouTube/Vimeo (protects LCP) and a plain `<video>` for self-hosted (mirrors the existing `ProductGallery` pattern). `CookingTip` is a new, independent content type following the Service→Repository layering already established by `recipe.service.ts`/`recipe.repository.ts`, with its own minimal two-value status enum (no moderation pipeline — admin-authored only). The Cooking Tips listing is a plain Server Component reading `searchParams` directly — no client filter state, unlike `/recipes`, because it has only one filter dimension and no search box.

**Tech Stack:** Next.js 16 Server/Client Components, Prisma 7 (`@prisma/adapter-pg`), Zod, Vitest, Playwright, Tailwind v4, `nuqs` (Recipe listing only).

**Spec:** `docs/stories/04-recipes-food-academy/STORY-019-video-recipes-cooking-tips.md` (acceptance criteria/tasks) and `docs/superpowers/specs/2026-09-25-video-cooking-tips-design.md` (13 design decisions this plan implements — route choices, video facade pattern, captions scope, enum naming, filter UX). Executors read both.

## Global Constraints

- TypeScript strict mode — no `any`, no implicit types.
- Database access only through the Repository layer — routes/components call Services, Services call Repositories.
- Only `status: "Published"` recipes/cooking tips are ever visible on the storefront.
- Prisma enum values are PascalCase single words (`Draft`, `Published`, `Youtube`, `Vimeo`, `SelfHosted`) — never the story text's ALL-CAPS shorthand.
- Every list query orders with a final tiebreaker on a unique column (existing pattern: `buildRecipeOrderBy` always ends `id: "asc"`).
- `CookingTip.bodyContent` is a plain string rendered with `whitespace-pre-line` — no markdown dependency.
- `captionsUrl` only ever renders for `videoProvider: "SelfHosted"` — never attempt to inject a caption track into a YouTube/Vimeo iframe.
- New Client Components stay isolated: `VideoPlayer` is the only genuinely new one. The Cooking Tips listing and detail pages are Server Components with zero client JS.
- `DATABASE_POOL_MAX=1` must be set in this worktree's `.env` (already done during worktree setup).
- Conventional Commits for every commit (`feat:`, `test:`, `fix:`, `docs:`).

## Review Focus

- **A recipe with an invalid/unparseable `videoUrl`** (e.g. malformed at the DB level, or a provider `normalizeVideoUrl` can't recognize) → the page must not crash; `VideoPlayer` (or the page) falls back to rendering the static hero image, matching "Recipes without an associated video render the existing static hero image" behavior.
- **A YouTube/Vimeo iframe must never auto-mount on initial page load** — it's the entire point of the facade pattern (LCP protection) and the easiest thing for an implementer to get subtly wrong (e.g. rendering the iframe but visually hiding it still costs the network request). Covered in Task 9's `VideoPlayer` test.
- **A cooking tip or recipe-video path that leaks Draft content** — `getCookingTipBySlug` for a Draft tip, and `listCookingTips` never including Draft rows, mirroring the STORY-018 Published-only invariant exactly. Covered in Tasks 5-6.
- **`normalizeVideoUrl` given garbage input** (empty string, a non-video URL, a URL from an unsupported provider) must return `null`, never throw — this function runs at both the authoring boundary (future STORY-043) and render time. Covered in Task 2.
- **Two recipes/tips with the same `topicTag`/related-matching dimension but different statuses** — related-tips and the video-recipe filter must still only surface Published rows, not leak Draft/Archived ones through a related-content side door. Covered in Tasks 3 and 5.

---

## Task 1: Database — Recipe video fields, `CookingTip`, `CookingTipProductRef`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_video_cooking_tips/migration.sql` (generated)
- Modify: `prisma/seed-recipes.ts` (add `videoUrl`/`videoProvider`/`videoDurationSeconds` to a few recipes)
- Create: `prisma/seed-cooking-tips.ts` (8-10 sample tips)
- Modify: `prisma/seed.ts` (call the new seed function)

**Interfaces:**
- Produces: `Recipe.videoUrl/videoProvider/videoDurationSeconds/captionsUrl` (all nullable); `enum VideoProvider { Youtube Vimeo SelfHosted }`; `enum CookingTipStatus { Draft Published }`; `CookingTip { id, slug, title, summary, bodyContent, videoUrl?, videoProvider?, imageUrl?, topicTag, status, publishedAt?, createdAt, updatedAt }`; `CookingTipProductRef { id, cookingTipId, productId }`. Later tasks' repositories select these fields by these exact names.

- [ ] **Step 1: Add the video fields to `Recipe` and the `VideoProvider` enum**

In `prisma/schema.prisma`, add the enum near `RecipeDifficulty`:

```prisma
enum VideoProvider {
  Youtube
  Vimeo
  SelfHosted
}
```

Extend the `Recipe` model (after `galleryImageUrls`, before `ingredients`):

```prisma
  galleryImageUrls String[]           @default([])
  videoUrl             String?
  videoProvider        VideoProvider?
  videoDurationSeconds Int?
  // Only meaningful when videoProvider is SelfHosted — a caption track
  // can't be injected into a cross-origin YouTube/Vimeo iframe.
  captionsUrl          String?
  ingredients      RecipeIngredient[]
```

- [ ] **Step 2: Add `CookingTip`, `CookingTipStatus`, `CookingTipProductRef`**

```prisma
enum CookingTipStatus {
  Draft
  Published
}

model CookingTip {
  id          String            @id @default(cuid())
  slug        String            @unique
  title       String
  summary     String
  // Plain text, not markdown — rendered with whitespace-pre-line. See
  // design doc decision 5.
  bodyContent String
  videoUrl             String?
  videoProvider        VideoProvider?
  imageUrl             String?
  topicTag    String
  status      CookingTipStatus  @default(Draft)
  publishedAt DateTime?
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  productRefs CookingTipProductRef[]

  @@index([status, publishedAt])
  @@index([status, topicTag])
}

model CookingTipProductRef {
  id           String     @id @default(cuid())
  cookingTipId String
  cookingTip   CookingTip @relation(fields: [cookingTipId], references: [id], onDelete: Cascade)
  productId    String
  product      Product    @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([cookingTipId, productId])
  @@index([productId])
}
```

Add the inverse relation on `Product` (near the existing `recipeIngredients` relation added in STORY-018):

```prisma
  cookingTipRefs CookingTipProductRef[]
```

- [ ] **Step 3: Restart the local DB and generate the migration**

```bash
npx prisma migrate dev --name add_video_cooking_tips
```

If it fails with a PGlite lock/shadow-DB error, restart the dev DB server first (`npx prisma dev --detach --db-port 51214 --shadow-db-port 51215`, waiting ~20s after any prior kill), then retry. If `migrate dev` repeatably fails on the PGlite shadow-DB bug even after a restart, fall back to the documented offline-diff workaround: `npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datasource prisma/schema.prisma --script` is backwards — instead diff the *previous* schema state against the new one via `git show HEAD:prisma/schema.prisma > /tmp/prev-schema.prisma && npx prisma migrate diff --from-schema-datamodel /tmp/prev-schema.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<timestamp>_add_video_cooking_tips/migration.sql`, then `npx prisma db execute --file <that file>` to apply it, then `npx prisma migrate resolve --applied <timestamp>_add_video_cooking_tips`.

- [ ] **Step 4: Regenerate the Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 5: Seed video fields onto a few recipes**

In `prisma/seed-recipes.ts`, add to 2-3 of the existing recipe objects (e.g. `sri-lankan-chicken-curry`, `dhal-curry-parippu`):

```typescript
  videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  videoProvider: "Youtube",
  videoDurationSeconds: 420,
```

Leave the rest without video fields (they default to `null`) — this exercises both the "has video" and "no video" render paths.

- [ ] **Step 6: Create the cooking-tip seed**

Create `prisma/seed-cooking-tips.ts` following the structure of `prisma/seed-recipes.ts`: an array of 8-10 tips across at least 3 distinct `topicTag` values (e.g. `"knife-skills"`, `"spice-tempering"`, `"storage"`), a mix of `status: "Published"` and at least one `"Draft"` (to exercise the Published-only filter), at least one tip with a `productRefs` entry linking to a real seeded product slug (reuse `requireId`/product-lookup helper pattern from `seed-recipes.ts`), and a mix of `videoUrl` (some) vs `imageUrl`-only (others, no video). Export a `seedCookingTips()` function that inserts them via `prisma.cookingTip.create` with nested `productRefs: { create: [...] }`.

- [ ] **Step 7: Wire the new seed into `prisma/seed.ts`**

In `prisma/seed.ts`, add `import { seedCookingTips } from "./seed-cooking-tips";` and, right after the existing `const recipeSeed = await seedRecipes();` line, add `const cookingTipSeed = await seedCookingTips();`. Then add `cookingTips: cookingTipSeed,` to the `console.log("Seed complete:", {...})` object at the end of the file (it currently logs `brand`/`categories`/`collection`/`products`/`recipes` — add `cookingTips` as one more key in that same object, same style as `recipes: recipeSeed`).

- [ ] **Step 8: Reseed and verify**

```bash
npx prisma db execute --file tests/unit/truncate-all.sql
npx tsx --env-file=.env prisma/seed.ts
```

Expected: exits 0, the "Seed complete:" log includes a `cookingTips` key. Spot-check that at least 2 recipes have `videoUrl` set and the rest don't, and that the cooking tips include at least one Draft (excluded from all storefront queries later).

- [ ] **Step 9: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/seed-recipes.ts prisma/seed-cooking-tips.ts prisma/seed.ts
git commit -m "feat: add recipe video fields and the CookingTip content type"
```

---

## Task 2: Video URL normalization helper

**Files:**
- Create: `src/lib/video-url.ts`
- Test: `tests/unit/video-url.test.ts`

**Interfaces:**
- Produces: `type NormalizedVideo = { provider: "Youtube" | "Vimeo" | "SelfHosted"; embedId: string | null; url: string }`, `normalizeVideoUrl(rawUrl: string): NormalizedVideo | null`, `youtubeThumbnailUrl(embedId: string): string`. Task 8 (`VideoPlayer`) imports these by these exact names. No API in this story writes a video URL (see design decision 14), so Task 4's Zod schema does NOT wrap this function — it's consumed only at render time.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, expect, it } from "vitest";
import { normalizeVideoUrl, youtubeThumbnailUrl } from "@/lib/video-url";

describe("normalizeVideoUrl", () => {
  it("recognizes youtube.com/watch?v= URLs", () => {
    expect(normalizeVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      provider: "Youtube",
      embedId: "dQw4w9WgXcQ",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
  });

  it("recognizes youtu.be short URLs", () => {
    expect(normalizeVideoUrl("https://youtu.be/dQw4w9WgXcQ")).toMatchObject({
      provider: "Youtube",
      embedId: "dQw4w9WgXcQ",
    });
  });

  it("recognizes youtube.com/embed/ URLs", () => {
    expect(normalizeVideoUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toMatchObject({
      provider: "Youtube",
      embedId: "dQw4w9WgXcQ",
    });
  });

  it("recognizes vimeo.com/<id> URLs", () => {
    expect(normalizeVideoUrl("https://vimeo.com/76979871")).toEqual({
      provider: "Vimeo",
      embedId: "76979871",
      url: "https://vimeo.com/76979871",
    });
  });

  it("recognizes player.vimeo.com/video/<id> URLs", () => {
    expect(normalizeVideoUrl("https://player.vimeo.com/video/76979871")).toMatchObject({
      provider: "Vimeo",
      embedId: "76979871",
    });
  });

  it("treats a direct file URL as self-hosted", () => {
    expect(normalizeVideoUrl("https://cdn.oristor.com/videos/chicken-curry.mp4")).toEqual({
      provider: "SelfHosted",
      embedId: null,
      url: "https://cdn.oristor.com/videos/chicken-curry.mp4",
    });
  });

  it("returns null for empty, malformed, or non-video-looking input", () => {
    expect(normalizeVideoUrl("")).toBeNull();
    expect(normalizeVideoUrl("not a url")).toBeNull();
  });
});

describe("youtubeThumbnailUrl", () => {
  it("builds the hqdefault thumbnail URL", () => {
    expect(youtubeThumbnailUrl("dQw4w9WgXcQ")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/video-url.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
export type VideoProvider = "Youtube" | "Vimeo" | "SelfHosted";

export interface NormalizedVideo {
  provider: VideoProvider;
  /** The provider's video ID; null for SelfHosted (the url IS the file). */
  embedId: string | null;
  url: string;
}

const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtube\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{6,})/,
];
const VIMEO_PATTERNS = [/(?:vimeo\.com\/(?:video\/)?)([0-9]+)/];

function tryParseUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

export function normalizeVideoUrl(rawUrl: string): NormalizedVideo | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  const parsed = tryParseUrl(trimmed);
  if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) return null;

  for (const pattern of YOUTUBE_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) return { provider: "Youtube", embedId: match[1], url: trimmed };
  }
  for (const pattern of VIMEO_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) return { provider: "Vimeo", embedId: match[1], url: trimmed };
  }
  return { provider: "SelfHosted", embedId: null, url: trimmed };
}

export function youtubeThumbnailUrl(embedId: string): string {
  return `https://i.ytimg.com/vi/${embedId}/hqdefault.jpg`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/video-url.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/video-url.ts tests/unit/video-url.test.ts
git commit -m "feat: add video URL normalization helper"
```

---

## Task 3: Recipe repository/service — `hasVideo` filter and `RecipeCard.hasVideo`

**Files:**
- Modify: `src/lib/recipe-listing-values.ts` (add `hasVideo` to `RecipeFilters`)
- Modify: `src/validation/recipe-listing.schema.ts` (add `hasVideo` to the query schema)
- Modify: `src/lib/recipe-listing-params.ts` (add `hasVideo` nuqs parser)
- Modify: `src/repositories/recipe.repository.ts` (`buildRecipeWhere` handles `hasVideo`; `recipeCardSelect`/`recipeDetailSelect` include video fields)
- Modify: `src/types/recipe.ts` (`RecipeCard.hasVideo`, `RecipeDetail` video fields)
- Modify: `src/services/recipe.service.ts` (`toRecipeCard` maps `hasVideo`; `getRecipeBySlug` maps video fields)
- Test: `tests/unit/recipe-repository.test.ts` (existing file — add to it)
- Test: `tests/unit/recipe-service.test.ts` (existing file — add to it)

**Interfaces:**
- Consumes: nothing new from other tasks.
- Produces: `RecipeFilters.hasVideo?: boolean`; `RecipeCard.hasVideo: boolean`; `RecipeDetail.video: { url: string; provider: "Youtube"|"Vimeo"|"SelfHosted"; durationSeconds: number | null; captionsUrl: string | null } | null`. Task 9 (VideoPlayer/RecipeHero integration), Task 10 (RecipeCard badge, filter checkbox) consume these.

- [ ] **Step 1: Write the failing tests**

Add to `tests/unit/recipe-repository.test.ts` (matching the file's existing `makeCategory`/`makeRecipe` real-DB fixture style):

```typescript
describe("hasVideo filter", () => {
  it("only returns recipes with a videoUrl when hasVideo is true", async () => {
    const category = await makeCategory();
    await makeRecipe(category.id, { title: "Has Video", videoUrl: "https://youtu.be/abc123", videoProvider: "Youtube" });
    await makeRecipe(category.id, { title: "No Video" });

    expect(await titlesFor({ hasVideo: true })).toEqual(["Has Video"]);
    expect((await titlesFor({})).sort()).toEqual(["Has Video", "No Video"]);
  });
});
```

You'll need to extend `RecipeFixtureOverrides`/`makeRecipe` in `tests/unit/recipe-fixtures.ts` with `videoUrl?`/`videoProvider?` overrides (same pattern as the existing `ingredients`/`steps` overrides added in STORY-018).

Add to `tests/unit/recipe-service.test.ts`:

```typescript
describe("toRecipeCard hasVideo", () => {
  it("maps hasVideo true/false correctly", async () => {
    const category = await makeCategory();
    await makeRecipe(category.id, { title: "Video One", videoUrl: "https://youtu.be/abc123", videoProvider: "Youtube" });
    await makeRecipe(category.id, { title: "No Video One" });

    const result = await listRecipes({ page: 1, pageSize: 10, sort: "newest" });
    const videoCard = result.recipes.find((r) => r.title === "Video One");
    const noVideoCard = result.recipes.find((r) => r.title === "No Video One");
    expect(videoCard?.hasVideo).toBe(true);
    expect(noVideoCard?.hasVideo).toBe(false);
  });
});

describe("getRecipeBySlug video field", () => {
  it("maps the video object when present, null when absent", async () => {
    const category = await makeCategory();
    await makeRecipe(category.id, {
      slug: "with-video", videoUrl: "https://youtu.be/abc123", videoProvider: "Youtube",
      videoDurationSeconds: 300, captionsUrl: null,
    });
    await makeRecipe(category.id, { slug: "without-video" });

    const withVideo = await getRecipeBySlug("with-video");
    const withoutVideo = await getRecipeBySlug("without-video");
    expect(withVideo?.video).toEqual({ url: "https://youtu.be/abc123", provider: "Youtube", durationSeconds: 300, captionsUrl: null });
    expect(withoutVideo?.video).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run tests/unit/recipe-repository.test.ts tests/unit/recipe-service.test.ts
```

Expected: FAIL — `hasVideo` not a recognized filter/field.

- [ ] **Step 3: Implement**

In `src/lib/recipe-listing-values.ts`, add to `RecipeFilters`:

```typescript
export interface RecipeFilters {
  category?: string;
  difficulty?: RecipeDifficultyParam[];
  time?: RecipeTimeRange[];
  diet?: string[];
  q?: string;
  hasVideo?: boolean;
}
```

In `src/validation/recipe-listing.schema.ts`, add (matching `product-listing.schema.ts`'s `inStock` pattern exactly):

```typescript
  hasVideo: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional()
    .catch(undefined),
```

In `src/lib/recipe-listing-params.ts`, import `parseAsBoolean` from `"nuqs/server"` and add `hasVideo: parseAsBoolean` to `recipeListingParsers`.

In `src/repositories/recipe.repository.ts`, in `buildRecipeWhere`, add:

```typescript
  if (filters.hasVideo) {
    and.push({ videoUrl: { not: null } });
  }
```

Add to `recipeCardSelect`: `videoUrl: true,` (just the presence check — the mapper below derives the boolean, never leaking the URL itself into `RecipeCard`). Add to `recipeDetailSelect`: `videoUrl: true, videoProvider: true, videoDurationSeconds: true, captionsUrl: true,`.

In `src/types/recipe.ts`, add to `RecipeCard`: `hasVideo: boolean;`. Add to `RecipeDetail`:

```typescript
  video: { url: string; provider: "Youtube" | "Vimeo" | "SelfHosted"; durationSeconds: number | null; captionsUrl: string | null } | null;
```

In `src/services/recipe.service.ts`, in `toRecipeCard`, add `hasVideo: row.videoUrl !== null,`. In `getRecipeBySlug`'s mapping, add:

```typescript
    video: row.videoUrl === null || row.videoProvider === null
      ? null
      : { url: row.videoUrl, provider: row.videoProvider, durationSeconds: row.videoDurationSeconds, captionsUrl: row.captionsUrl },
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run tests/unit/recipe-repository.test.ts tests/unit/recipe-service.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recipe-listing-values.ts src/validation/recipe-listing.schema.ts src/lib/recipe-listing-params.ts src/repositories/recipe.repository.ts src/types/recipe.ts src/services/recipe.service.ts tests/unit/recipe-repository.test.ts tests/unit/recipe-service.test.ts tests/unit/recipe-fixtures.ts
git commit -m "feat: add hasVideo recipe filter and video fields to recipe reads"
```

---

## Task 4: Cooking-tip types and validation schemas

**Files:**
- Create: `src/types/cooking-tip.ts`
- Create: `src/validation/cooking-tip.schema.ts`
- Test: `tests/unit/cooking-tip-schema.test.ts`

**Interfaces:**
- Consumes: `normalizeVideoUrl` (Task 2) is NOT used here (that's an authoring-boundary concern for future STORY-043) — this task only validates query params.
- Produces: `CookingTipCard { id, slug, href, title, summary, imageUrl: string | null, hasVideo: boolean, topicTag: string }`, `CookingTipDetail { ...CookingTipCard fields, bodyContent: string, video: {...} | null, relatedTips: CookingTipCard[], products: {id,slug,name}[] }`, `CookingTipListResult { tips: CookingTipCard[]; total: number; page: number; pageSize: number }`, `cookingTipListQuerySchema`, `cookingTipSlugParamSchema`. Tasks 5-8 consume these.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { cookingTipListQuerySchema, cookingTipSlugParamSchema } from "@/validation/cooking-tip.schema";

describe("cookingTipListQuerySchema", () => {
  it("defaults page/pageSize and leaves topic undefined when absent", () => {
    const result = cookingTipListQuerySchema.parse({});
    expect(result).toMatchObject({ page: 1, pageSize: 12 });
    expect(result.topic).toBeUndefined();
  });

  it("passes through a topic filter", () => {
    expect(cookingTipListQuerySchema.parse({ topic: "knife-skills" }).topic).toBe("knife-skills");
  });

  it("falls back to defaults for malformed page/pageSize", () => {
    expect(cookingTipListQuerySchema.parse({ page: "not-a-number", pageSize: "-5" })).toMatchObject({ page: 1, pageSize: 12 });
  });
});

describe("cookingTipSlugParamSchema", () => {
  it("accepts a non-empty slug", () => {
    expect(cookingTipSlugParamSchema.safeParse({ slug: "knife-basics" }).success).toBe(true);
  });
  it("rejects an empty slug", () => {
    expect(cookingTipSlugParamSchema.safeParse({ slug: "" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/cooking-tip-schema.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/types/cooking-tip.ts`:

```typescript
export interface CookingTipCard {
  id: string;
  slug: string;
  href: string;
  title: string;
  summary: string;
  imageUrl: string | null;
  hasVideo: boolean;
  topicTag: string;
}

export interface CookingTipDetail extends CookingTipCard {
  bodyContent: string;
  video: { url: string; provider: "Youtube" | "Vimeo" | "SelfHosted" } | null;
  relatedTips: CookingTipCard[];
  products: { id: string; slug: string; name: string }[];
}

export interface CookingTipListResult {
  tips: CookingTipCard[];
  total: number;
  page: number;
  pageSize: number;
}
```

`src/validation/cooking-tip.schema.ts` (same `.catch()`-everywhere policy as `recipeListingQuerySchema`):

```typescript
import { z } from "zod";

export const cookingTipListQuerySchema = z.object({
  topic: z.string().trim().min(1).optional().catch(undefined),
  page: z.coerce.number().int().positive().catch(1),
  pageSize: z.coerce.number().int().positive().max(48).catch(12),
});
export type CookingTipListQuery = z.infer<typeof cookingTipListQuerySchema>;

export const cookingTipSlugParamSchema = z.object({
  slug: z.string().min(1),
});
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/cooking-tip-schema.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types/cooking-tip.ts src/validation/cooking-tip.schema.ts tests/unit/cooking-tip-schema.test.ts
git commit -m "feat: add cooking tip types and validation schemas"
```

---

## Task 5: Cooking-tip repository

**Files:**
- Create: `src/repositories/cooking-tip.repository.ts`
- Test: `tests/unit/cooking-tip-repository.test.ts`
- Modify: `tests/unit/recipe-fixtures.ts` (rename mentally as "content fixtures" is out of scope — just add `makeCookingTip` here, matching the file's existing `makeCategory`/`makeRecipe` style; do not rename the file)

**Interfaces:**
- Produces: `cookingTipCardSelect`, `CookingTipCardRow`, `cookingTipDetailSelect`, `CookingTipDetailRow`, `findPublishedCookingTips(args: {where, skip, take}): Promise<{rows, total}>`, `findPublishedCookingTipBySlug(slug: string): Promise<CookingTipDetailRow | null>`, `findRelatedCookingTips(tip: {id, topicTag}, limit: number): Promise<CookingTipCardRow[]>`, `findActiveTopicTagsWithPublishedTips(): Promise<{tag: string}[]>`, `createCookingTip(data: Prisma.CookingTipUncheckedCreateInput)`. Task 6 (service) imports these.

- [ ] **Step 1: Write the failing tests**

Add `makeCookingTip` to `tests/unit/recipe-fixtures.ts`:

```typescript
export interface CookingTipFixtureOverrides {
  slug?: string;
  title?: string;
  summary?: string;
  bodyContent?: string;
  videoUrl?: string | null;
  videoProvider?: VideoProvider | null;
  imageUrl?: string | null;
  topicTag?: string;
  status?: CookingTipStatus;
  publishedAt?: Date | null;
  productIds?: string[];
}

export function makeCookingTip(overrides: CookingTipFixtureOverrides = {}) {
  const n = nextNumber();
  return createCookingTip({
    slug: overrides.slug ?? `cooking-tip-${n}`,
    title: overrides.title ?? `Cooking Tip ${n}`,
    summary: overrides.summary ?? "A test cooking tip.",
    bodyContent: overrides.bodyContent ?? "Body content.",
    videoUrl: overrides.videoUrl ?? null,
    videoProvider: overrides.videoProvider ?? null,
    imageUrl: overrides.imageUrl ?? "/images/products/export/curry-powder.webp",
    topicTag: overrides.topicTag ?? "general",
    status: overrides.status ?? "Published",
    publishedAt: overrides.publishedAt === undefined ? new Date("2026-09-01T00:00:00Z") : overrides.publishedAt,
    productRefs: { create: (overrides.productIds ?? []).map((productId) => ({ productId })) },
  });
}
```

Add `prisma.cookingTip.deleteMany()` to `cleanupRecipes()` (or add a new `cleanupCookingTips()` if the test file's convention is per-content-type cleanup — check the file first and match its style).

`tests/unit/cooking-tip-repository.test.ts`:

```typescript
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { createProduct } from "@/repositories/product.repository";
import {
  findActiveTopicTagsWithPublishedTips,
  findPublishedCookingTipBySlug,
  findPublishedCookingTips,
  findRelatedCookingTips,
} from "@/repositories/cooking-tip.repository";
import { cleanupRecipes, makeCookingTip } from "./recipe-fixtures";

afterEach(async () => {
  await cleanupRecipes();
});

describe("findPublishedCookingTips", () => {
  it("only returns Published tips, filtered by topic when given", async () => {
    await makeCookingTip({ title: "Published Knife", topicTag: "knife-skills" });
    await makeCookingTip({ title: "Draft Knife", topicTag: "knife-skills", status: "Draft" });
    await makeCookingTip({ title: "Published Storage", topicTag: "storage" });

    const all = await findPublishedCookingTips({ where: {}, skip: 0, take: 10 });
    expect(all.rows.map((r) => r.title).sort()).toEqual(["Published Knife", "Published Storage"]);

    const knifeOnly = await findPublishedCookingTips({ where: { topicTag: "knife-skills" }, skip: 0, take: 10 });
    expect(knifeOnly.rows.map((r) => r.title)).toEqual(["Published Knife"]);
  });
});

describe("findPublishedCookingTipBySlug", () => {
  it("returns null for a missing or Draft slug", async () => {
    await makeCookingTip({ slug: "draft-tip", status: "Draft" });
    expect(await findPublishedCookingTipBySlug("draft-tip")).toBeNull();
    expect(await findPublishedCookingTipBySlug("does-not-exist")).toBeNull();
  });

  it("includes linked products", async () => {
    const product = await createProduct({ sku: "SKU-CT-1", slug: "curry-powder-ct", name: "Curry Powder" });
    await makeCookingTip({ slug: "with-product", productIds: [product.id] });

    const result = await findPublishedCookingTipBySlug("with-product");
    expect(result?.productRefs.map((ref) => ref.product.slug)).toEqual(["curry-powder-ct"]);
  });
});

describe("findRelatedCookingTips", () => {
  it("excludes the tip itself and only returns Published tips sharing the topic", async () => {
    const target = await makeCookingTip({ slug: "target", topicTag: "knife-skills" });
    await makeCookingTip({ slug: "same-topic", topicTag: "knife-skills" });
    await makeCookingTip({ slug: "draft-same-topic", topicTag: "knife-skills", status: "Draft" });
    await makeCookingTip({ slug: "other-topic", topicTag: "storage" });

    const related = await findRelatedCookingTips({ id: target.id, topicTag: target.topicTag }, 6);
    expect(related.map((r) => r.slug)).toEqual(["same-topic"]);
  });
});

describe("findActiveTopicTagsWithPublishedTips", () => {
  it("returns distinct topic tags that have at least one Published tip", async () => {
    await makeCookingTip({ topicTag: "knife-skills" });
    await makeCookingTip({ topicTag: "knife-skills" });
    await makeCookingTip({ topicTag: "storage-only-drafts", status: "Draft" });

    const tags = await findActiveTopicTagsWithPublishedTips();
    expect(tags.map((t) => t.tag)).toEqual(["knife-skills"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run tests/unit/cooking-tip-repository.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/repositories/cooking-tip.repository.ts`:

```typescript
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export const cookingTipCardSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  imageUrl: true,
  videoUrl: true,
  topicTag: true,
} satisfies Prisma.CookingTipSelect;

export type CookingTipCardRow = Prisma.CookingTipGetPayload<{ select: typeof cookingTipCardSelect }>;

export async function findPublishedCookingTips(args: {
  where: Prisma.CookingTipWhereInput;
  skip: number;
  take: number;
}): Promise<{ rows: CookingTipCardRow[]; total: number }> {
  // AND-composed, not spread-merged: a plain `{ status: "Published",
  // ...args.where }` lets a caller-supplied `where.status` silently win
  // (object-spread, later key wins) and override the Published-only
  // invariant. Same pattern as buildRecipeWhere in recipe.repository.ts.
  const where: Prisma.CookingTipWhereInput = { AND: [{ status: "Published" }, args.where] };
  const [rows, total] = await prisma.$transaction([
    prisma.cookingTip.findMany({
      where,
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      skip: args.skip,
      take: args.take,
      select: cookingTipCardSelect,
    }),
    prisma.cookingTip.count({ where }),
  ]);
  return { rows, total };
}

export const cookingTipDetailSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  bodyContent: true,
  imageUrl: true,
  videoUrl: true,
  videoProvider: true,
  topicTag: true,
  productRefs: {
    select: { product: { select: { id: true, slug: true, name: true } } },
  },
} satisfies Prisma.CookingTipSelect;

export type CookingTipDetailRow = Prisma.CookingTipGetPayload<{ select: typeof cookingTipDetailSelect }>;

export function findPublishedCookingTipBySlug(slug: string): Promise<CookingTipDetailRow | null> {
  return prisma.cookingTip.findFirst({
    where: { slug, status: "Published" },
    select: cookingTipDetailSelect,
  });
}

export function findRelatedCookingTips(
  tip: { id: string; topicTag: string },
  limit: number,
): Promise<CookingTipCardRow[]> {
  return prisma.cookingTip.findMany({
    where: { status: "Published", id: { not: tip.id }, topicTag: tip.topicTag },
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
    take: limit,
    select: cookingTipCardSelect,
  });
}

export function findActiveTopicTagsWithPublishedTips(): Promise<{ tag: string }[]> {
  return prisma.cookingTip
    .findMany({
      where: { status: "Published" },
      select: { topicTag: true },
      distinct: ["topicTag"],
      orderBy: { topicTag: "asc" },
    })
    .then((rows) => rows.map((row) => ({ tag: row.topicTag })));
}

export function createCookingTip(data: Prisma.CookingTipUncheckedCreateInput) {
  return prisma.cookingTip.create({ data });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run tests/unit/cooking-tip-repository.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/repositories/cooking-tip.repository.ts tests/unit/cooking-tip-repository.test.ts tests/unit/recipe-fixtures.ts
git commit -m "feat: add cooking tip repository queries"
```

---

## Task 6: Cooking-tip service

**Files:**
- Create: `src/services/cooking-tip.service.ts`
- Test: `tests/unit/cooking-tip-service.test.ts`

**Interfaces:**
- Consumes: Task 4's types, Task 5's repository functions.
- Produces: `listCookingTips(query: CookingTipListQuery): Promise<CookingTipListResult>`, `listCookingTipTopics(): Promise<{tag: string}[]>`, `getCookingTipBySlug(slug: string): Promise<CookingTipDetail | null>`. Task 7 (route) and the listing/detail pages call these.

- [ ] **Step 1: Write the failing test** (real DB-backed style, matching `recipe-service.test.ts`'s established convention — no mocking)

```typescript
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { getCookingTipBySlug, listCookingTips, listCookingTipTopics } from "@/services/cooking-tip.service";
import { cleanupRecipes, makeCookingTip } from "./recipe-fixtures";

afterEach(async () => {
  await cleanupRecipes();
});

describe("listCookingTips", () => {
  it("maps rows to CookingTipCard and echoes page/pageSize", async () => {
    await makeCookingTip({ title: "Tip One", topicTag: "knife-skills" });
    const result = await listCookingTips({ page: 1, pageSize: 10 });
    expect(result).toMatchObject({ page: 1, pageSize: 10, total: 1 });
    expect(result.tips[0]).toMatchObject({ title: "Tip One", href: "/recipes/cooking-tips/tip-one".replace("tip-one", result.tips[0]!.slug) });
  });

  it("filters by topic", async () => {
    await makeCookingTip({ title: "Knife", topicTag: "knife-skills" });
    await makeCookingTip({ title: "Storage", topicTag: "storage" });
    const result = await listCookingTips({ page: 1, pageSize: 10, topic: "storage" });
    expect(result.tips.map((t) => t.title)).toEqual(["Storage"]);
  });
});

describe("getCookingTipBySlug", () => {
  it("returns null for missing/Draft, maps video/products/relatedTips for a real tip", async () => {
    expect(await getCookingTipBySlug("nope")).toBeNull();

    await makeCookingTip({ slug: "draft", status: "Draft" });
    expect(await getCookingTipBySlug("draft")).toBeNull();

    await makeCookingTip({ slug: "full", topicTag: "knife-skills", videoUrl: "https://youtu.be/abc", videoProvider: "Youtube" });
    await makeCookingTip({ slug: "related", topicTag: "knife-skills" });

    const result = await getCookingTipBySlug("full");
    expect(result?.video).toEqual({ url: "https://youtu.be/abc", provider: "Youtube" });
    expect(result?.relatedTips.map((t) => t.slug)).toEqual(["related"]);
  });
});

describe("listCookingTipTopics", () => {
  it("returns distinct topics with Published tips", async () => {
    await makeCookingTip({ topicTag: "knife-skills" });
    expect(await listCookingTipTopics()).toEqual([{ tag: "knife-skills" }]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/cooking-tip-service.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```typescript
import * as cookingTipRepository from "@/repositories/cooking-tip.repository";
import type { CookingTipCardRow, CookingTipDetailRow } from "@/repositories/cooking-tip.repository";
import type { CookingTipCard, CookingTipDetail, CookingTipListResult } from "@/types/cooking-tip";
import type { CookingTipListQuery } from "@/validation/cooking-tip.schema";

function tipHref(slug: string): string {
  return `/recipes/cooking-tips/${slug}`;
}

function toCookingTipCard(row: CookingTipCardRow): CookingTipCard {
  return {
    id: row.id,
    slug: row.slug,
    href: tipHref(row.slug),
    title: row.title,
    summary: row.summary,
    imageUrl: row.imageUrl,
    hasVideo: row.videoUrl !== null,
    topicTag: row.topicTag,
  };
}

export async function listCookingTips(query: CookingTipListQuery): Promise<CookingTipListResult> {
  const { page, pageSize, topic } = query;
  const { rows, total } = await cookingTipRepository.findPublishedCookingTips({
    where: topic ? { topicTag: topic } : {},
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return { tips: rows.map(toCookingTipCard), total, page, pageSize };
}

export function listCookingTipTopics() {
  return cookingTipRepository.findActiveTopicTagsWithPublishedTips();
}

export async function getCookingTipBySlug(slug: string): Promise<CookingTipDetail | null> {
  const row = await cookingTipRepository.findPublishedCookingTipBySlug(slug);
  if (!row) return null;

  const relatedRows = await cookingTipRepository.findRelatedCookingTips({ id: row.id, topicTag: row.topicTag }, 6);

  return {
    ...toCookingTipCard(row),
    bodyContent: row.bodyContent,
    video: row.videoUrl === null || row.videoProvider === null ? null : { url: row.videoUrl, provider: row.videoProvider },
    relatedTips: relatedRows.map(toCookingTipCard),
    products: row.productRefs.map((ref) => ref.product),
  };
}
```

Note: `CookingTipDetailRow` (Task 5's select) doesn't fetch `hasVideo` separately — `toCookingTipCard`'s `row.videoUrl !== null` works for both `CookingTipCardRow` and `CookingTipDetailRow` since both selects include `videoUrl`. If TypeScript complains about the union, add a small type guard or accept `{videoUrl: string|null}` as the parameter's minimal shape instead of the full row type.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/unit/cooking-tip-service.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/cooking-tip.service.ts tests/unit/cooking-tip-service.test.ts
git commit -m "feat: add cooking tip service"
```

---

## Task 7: API routes — `GET /api/cooking-tips`, `GET /api/cooking-tips/[slug]`

**Files:**
- Create: `src/app/api/cooking-tips/route.ts`
- Create: `src/app/api/cooking-tips/[slug]/route.ts`
- Test: `tests/unit/cooking-tips-route.test.ts`

**Interfaces:**
- Consumes: `listCookingTips`, `getCookingTipBySlug` (Task 6), `cookingTipListQuerySchema`, `cookingTipSlugParamSchema` (Task 4).

- [ ] **Step 1: Write the failing tests** (real DB-backed, matching `tests/unit/recipes-route.test.ts`'s convention)

```typescript
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { GET as getCookingTips } from "@/app/api/cooking-tips/route";
import { GET as getCookingTip } from "@/app/api/cooking-tips/[slug]/route";
import { cleanupRecipes, makeCookingTip } from "./recipe-fixtures";

afterEach(async () => {
  await cleanupRecipes();
});

describe("GET /api/cooking-tips", () => {
  it("returns Published tips with paging metadata", async () => {
    await makeCookingTip({ title: "Published Tip" });
    await makeCookingTip({ title: "Draft Tip", status: "Draft" });

    const response = await getCookingTips(new Request("http://localhost/api/cooking-tips"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.tips.map((t: { title: string }) => t.title)).toEqual(["Published Tip"]);
  });
});

describe("GET /api/cooking-tips/[slug]", () => {
  it("returns 200 for a Published slug, 404 for missing/Draft", async () => {
    await makeCookingTip({ slug: "published-tip" });
    await makeCookingTip({ slug: "draft-tip", status: "Draft" });

    const ok = await getCookingTip(new Request("http://localhost/api/cooking-tips/published-tip"), {
      params: Promise.resolve({ slug: "published-tip" }),
    });
    expect(ok.status).toBe(200);

    const draftResponse = await getCookingTip(new Request("http://localhost/api/cooking-tips/draft-tip"), {
      params: Promise.resolve({ slug: "draft-tip" }),
    });
    expect(draftResponse.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run tests/unit/cooking-tips-route.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

Read `src/app/api/recipes/route.ts` and `src/lib/api/responses.ts` first to match the exact established response-helper style (`serverErrorResponse` for the 500 path).

`src/app/api/cooking-tips/route.ts`:

```typescript
import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { listCookingTips } from "@/services/cooking-tip.service";
import { cookingTipListQuerySchema } from "@/validation/cooking-tip.schema";

export async function GET(request: Request) {
  const query = cookingTipListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  try {
    return NextResponse.json(await listCookingTips(query));
  } catch (error) {
    return serverErrorResponse(error, "GET /api/cooking-tips");
  }
}
```

`src/app/api/cooking-tips/[slug]/route.ts` (same shape as `src/app/api/recipes/[slug]/route.ts`):

```typescript
import { NextResponse } from "next/server";

import { getCookingTipBySlug } from "@/services/cooking-tip.service";
import { cookingTipSlugParamSchema } from "@/validation/cooking-tip.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = cookingTipSlugParamSchema.parse(await params);

  const tip = await getCookingTipBySlug(slug);
  if (!tip) {
    return NextResponse.json({ error: "Cooking tip not found" }, { status: 404 });
  }

  return NextResponse.json(tip, { status: 200 });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run tests/unit/cooking-tips-route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cooking-tips tests/unit/cooking-tips-route.test.ts
git commit -m "feat: add GET /api/cooking-tips and GET /api/cooking-tips/[slug]"
```

---

## Task 8: `VideoPlayer` component

**Files:**
- Create: `src/components/storefront/recipes/video-player.tsx` (Client Component)
- Test: `tests/unit/video-player.test.tsx`

**Interfaces:**
- Consumes: `normalizeVideoUrl`, `youtubeThumbnailUrl` (Task 2).
- Produces: `VideoPlayer({ video: { url, provider, durationSeconds?, captionsUrl? }, posterUrl, posterAlt }): JSX.Element`. Task 9 (RecipeHero integration) imports this.

- [ ] **Step 1: Write the failing tests**

```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { VideoPlayer } from "@/components/storefront/recipes/video-player";

describe("VideoPlayer", () => {
  it("does not render an iframe or video element before the user clicks play", () => {
    render(
      <VideoPlayer
        video={{ url: "https://youtu.be/dQw4w9WgXcQ", provider: "Youtube" }}
        posterUrl="/hero.jpg"
        posterAlt="Recipe hero"
      />,
    );
    expect(screen.queryByTitle(/play video/i)).not.toBeInTheDocument();
    expect(document.querySelector("iframe")).not.toBeInTheDocument();
  });

  it("mounts the YouTube iframe only after clicking the play button", async () => {
    const user = userEvent.setup();
    render(
      <VideoPlayer video={{ url: "https://youtu.be/dQw4w9WgXcQ", provider: "Youtube" }} posterUrl="/hero.jpg" posterAlt="Recipe hero" />,
    );
    await user.click(screen.getByRole("button", { name: /play video/i }));
    const iframe = document.querySelector("iframe");
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute("src", expect.stringContaining("youtube.com/embed/dQw4w9WgXcQ"));
  });

  it("mounts the Vimeo iframe only after clicking play", async () => {
    const user = userEvent.setup();
    render(<VideoPlayer video={{ url: "https://vimeo.com/76979871", provider: "Vimeo" }} posterUrl="/hero.jpg" posterAlt="Recipe hero" />);
    await user.click(screen.getByRole("button", { name: /play video/i }));
    expect(document.querySelector("iframe")).toHaveAttribute("src", expect.stringContaining("player.vimeo.com/video/76979871"));
  });

  it("renders a native video element directly for self-hosted, no click needed", () => {
    render(
      <VideoPlayer
        video={{ url: "https://cdn.oristor.com/v.mp4", provider: "SelfHosted", captionsUrl: "/captions.vtt" }}
        posterUrl="/hero.jpg"
        posterAlt="Recipe hero"
      />,
    );
    const video = document.querySelector("video");
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute("controls");
    expect(document.querySelector("track")).toHaveAttribute("src", "/captions.vtt");
  });

  it("falls back to a plain poster image when the URL doesn't normalize", () => {
    render(<VideoPlayer video={{ url: "not a real url", provider: "Youtube" }} posterUrl="/hero.jpg" posterAlt="Recipe hero" />);
    expect(screen.queryByRole("button", { name: /play video/i })).not.toBeInTheDocument();
    expect(screen.getByAltText("Recipe hero")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/unit/video-player.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import { normalizeVideoUrl, youtubeThumbnailUrl } from "@/lib/video-url";

interface VideoPlayerProps {
  video: { url: string; provider: "Youtube" | "Vimeo" | "SelfHosted"; durationSeconds?: number | null; captionsUrl?: string | null };
  posterUrl: string;
  posterAlt: string;
}

export function VideoPlayer({ video, posterUrl, posterAlt }: VideoPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const normalized = normalizeVideoUrl(video.url);

  if (!normalized) {
    return (
      <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-cream sm:aspect-16/9">
        <Image src={posterUrl} alt={posterAlt} fill className="object-cover" />
      </div>
    );
  }

  if (normalized.provider === "SelfHosted") {
    return (
      <video controls poster={posterUrl} className="aspect-4/3 w-full rounded-lg bg-black sm:aspect-16/9">
        <source src={normalized.url} />
        {video.captionsUrl && <track kind="captions" src={video.captionsUrl} />}
      </video>
    );
  }

  if (!playing) {
    const thumbnail = normalized.provider === "Youtube" && normalized.embedId ? youtubeThumbnailUrl(normalized.embedId) : posterUrl;
    return (
      <button
        type="button"
        onClick={() => setPlaying(true)}
        aria-label="Play video"
        className="relative block aspect-4/3 w-full overflow-hidden rounded-lg bg-cream sm:aspect-16/9"
      >
        <Image src={thumbnail} alt={posterAlt} fill className="object-cover" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Play className="size-14 fill-white text-white" aria-hidden="true" />
        </span>
      </button>
    );
  }

  const embedSrc =
    normalized.provider === "Youtube"
      ? `https://www.youtube.com/embed/${normalized.embedId}?autoplay=1`
      : `https://player.vimeo.com/video/${normalized.embedId}?autoplay=1`;

  return (
    <div className="aspect-4/3 overflow-hidden rounded-lg sm:aspect-16/9">
      <iframe
        src={embedSrc}
        title={posterAlt}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="size-full"
      />
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/video-player.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/storefront/recipes/video-player.tsx tests/unit/video-player.test.tsx
git commit -m "feat: add VideoPlayer with click-to-play facade for YouTube/Vimeo"
```

---

## Task 9: Integrate video into `RecipeHero`, `RecipeCard` badge, filter checkbox, nav link

**Files:**
- Modify: `src/components/storefront/recipes/recipe-hero.tsx`
- Modify: `src/app/(storefront)/recipes/[slug]/page.tsx` (pass `recipe.video` to `RecipeHero`)
- Modify: `src/components/storefront/recipes/recipe-card.tsx` (video badge)
- Modify: `src/components/storefront/recipes/recipe-filter-controls.tsx` (Has Video checkbox)
- Modify: `src/components/storefront/recipes/recipe-listing.tsx` (wire `hasVideo` through `RecipeFilterValues`/`handleFilterChange`)
- Modify: `src/lib/nav-config.ts` (Video Recipes link)
- Test: `tests/unit/recipe-hero.test.tsx` (new — confirmed this file does not exist yet)
- Test: `tests/unit/recipe-card.test.tsx` (existing — add a video-badge case)
- Test: `tests/unit/recipe-controls.test.tsx` (existing — confirmed this is the real file covering `RecipeFilterControls`; add a Has Video case)

**Interfaces:**
- Consumes: `VideoPlayer` (Task 8), `RecipeDetail.video`/`RecipeCard.hasVideo` (Task 3).

- [ ] **Step 1: Write the failing tests**

Check whether `tests/unit/recipe-hero.test.tsx` already exists; if not, create it:

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RecipeHero } from "@/components/storefront/recipes/recipe-hero";

describe("RecipeHero", () => {
  it("renders the static hero image when there is no video", () => {
    render(<RecipeHero heroImage="/hero.jpg" heroImageAlt="Dhal Curry" galleryImageUrls={[]} video={null} />);
    expect(screen.getByAltText("Dhal Curry")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /play video/i })).not.toBeInTheDocument();
  });

  it("renders VideoPlayer's play button when a video is present", () => {
    render(
      <RecipeHero
        heroImage="/hero.jpg"
        heroImageAlt="Dhal Curry"
        galleryImageUrls={[]}
        video={{ url: "https://youtu.be/abc123", provider: "Youtube" }}
      />,
    );
    expect(screen.getByRole("button", { name: /play video/i })).toBeInTheDocument();
  });
});
```

Add a case to `tests/unit/recipe-card.test.tsx`. Its existing top-level fixture is a const named `recipe: RecipeCardData` (not `hasVideo` yet — Task 3 adds that field to the type). Add a sibling `it` reusing that fixture with an override:

```typescript
it("shows a video badge when the recipe has video", () => {
  render(<RecipeCard recipe={{ ...recipe, hasVideo: true }} />);
  expect(screen.getByLabelText(/video available/i)).toBeInTheDocument();
});

it("omits the video badge when there is no video", () => {
  render(<RecipeCard recipe={{ ...recipe, hasVideo: false }} />);
  expect(screen.queryByLabelText(/video available/i)).not.toBeInTheDocument();
});
```

Add a case to `tests/unit/recipe-controls.test.tsx`'s existing `describe("RecipeFilterControls", ...)` block. There are exactly two `RecipeFilterValues`-shaped object literals in this file that need `hasVideo: false` added once `RecipeFilterValues` gains the field: line 16's `const noFilters: RecipeFilterValues = { difficulty: [], time: [], diet: [] };` and line 75's `expect(onChange).toHaveBeenNthCalledWith(1, { difficulty: [], time: [], diet: [] });` (inside the "Clear all filters" test). Update both, then add:

```typescript
it("calls onChange with hasVideo true when the Has Video checkbox is checked", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<RecipeFilterControls values={noFilters} onChange={onChange} onClear={vi.fn()} dietaryTagOptions={[]} />);
  await user.click(screen.getByRole("checkbox", { name: /has video/i }));
  expect(onChange).toHaveBeenCalledWith({ ...noFilters, hasVideo: true });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/unit/recipe-hero.test.tsx tests/unit/recipe-card.test.tsx
```

Expected: FAIL on the new assertions.

- [ ] **Step 3: Implement**

`RecipeHero` gains a `video` prop and renders `VideoPlayer` in place of the plain hero `<Image>` when non-null:

```tsx
import { VideoPlayer } from "@/components/storefront/recipes/video-player";
// ... existing imports

interface RecipeHeroProps {
  heroImage: string;
  heroImageAlt: string;
  galleryImageUrls: string[];
  video: { url: string; provider: "Youtube" | "Vimeo" | "SelfHosted"; durationSeconds?: number | null; captionsUrl?: string | null } | null;
}

export function RecipeHero({ heroImage, heroImageAlt, galleryImageUrls, video }: RecipeHeroProps) {
  return (
    <div>
      {video ? (
        <VideoPlayer video={video} posterUrl={heroImage} posterAlt={heroImageAlt} />
      ) : (
        <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-cream sm:aspect-16/9">
          <Image src={heroImage} alt={heroImageAlt} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
        </div>
      )}
      {/* ...existing gallery thumbnail strip, unchanged... */}
    </div>
  );
}
```

In `src/app/(storefront)/recipes/[slug]/page.tsx`, pass `video={recipe.video}` to `<RecipeHero>`.

In `recipe-card.tsx`, inside the image wrapper `<div>`, add a corner badge shown when `recipe.hasVideo`:

```tsx
{recipe.hasVideo && (
  <span
    aria-label="Video available"
    className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white"
  >
    <Play className="size-3.5 fill-current" aria-hidden="true" />
  </span>
)}
```

(Import `Play` from `lucide-react`.)

In `recipe-filter-controls.tsx`, extend `RecipeFilterValues` with `hasVideo: boolean` and add a `CheckboxOption`:

```tsx
export interface RecipeFilterValues {
  difficulty: RecipeDifficultyParam[];
  time: RecipeTimeRange[];
  diet: string[];
  hasVideo: boolean;
}
```

```tsx
<fieldset className="flex flex-col gap-2">
  <legend className="mb-2 text-small font-medium text-charcoal">Video</legend>
  <CheckboxOption label="Has video" checked={values.hasVideo} onCheckedChange={(checked) => onChange({ ...values, hasVideo: checked })} />
</fieldset>
```

In `recipe-listing.tsx`, wire `hasVideo` through `filterValues`/`handleFilterChange` the same way `difficulty`/`time`/`diet` already are (read `params.hasVideo ?? false`, write `next.hasVideo ? true : null` back through `setParams`).

In `nav-config.ts`, replace the placeholder comment:

```typescript
{ label: "Video Recipes", href: "/recipes?hasVideo=true" },
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/recipe-hero.test.tsx tests/unit/recipe-card.test.tsx
```

(Add the filter-controls test file to this command once you've confirmed its real name.)

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/storefront/recipes/recipe-hero.tsx "src/app/(storefront)/recipes/[slug]/page.tsx" src/components/storefront/recipes/recipe-card.tsx src/components/storefront/recipes/recipe-filter-controls.tsx src/components/storefront/recipes/recipe-listing.tsx src/lib/nav-config.ts tests/unit/recipe-hero.test.tsx tests/unit/recipe-card.test.tsx
git commit -m "feat: integrate video into RecipeHero, RecipeCard badge and recipe filters"
```

---

## Task 10: `CookingTipCard` and `/recipes/cooking-tips` listing page

**Files:**
- Create: `src/components/storefront/recipes/cooking-tip-card.tsx`
- Create: `src/app/(storefront)/recipes/cooking-tips/page.tsx`
- Test: `tests/unit/cooking-tip-card.test.tsx`

**Interfaces:**
- Consumes: `listCookingTips`, `listCookingTipTopics` (Task 6), `CookingTipCard` type (Task 4).

- [ ] **Step 1: Write the failing test**

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CookingTipCard } from "@/components/storefront/recipes/cooking-tip-card";

describe("CookingTipCard", () => {
  it("links to the tip's detail page and shows a video badge when applicable", () => {
    render(
      <CookingTipCard
        tip={{ id: "1", slug: "knife-basics", href: "/recipes/cooking-tips/knife-basics", title: "Knife Basics", summary: "Learn the grip.", imageUrl: "/img.webp", hasVideo: true, topicTag: "knife-skills" }}
      />,
    );
    expect(screen.getByRole("link", { name: /knife basics/i })).toHaveAttribute("href", "/recipes/cooking-tips/knife-basics");
    expect(screen.getByLabelText(/video available/i)).toBeInTheDocument();
  });

  it("omits the video badge when there is no video", () => {
    render(
      <CookingTipCard
        tip={{ id: "2", slug: "storage", href: "/recipes/cooking-tips/storage", title: "Storage", summary: "Keep it fresh.", imageUrl: null, hasVideo: false, topicTag: "storage" }}
      />,
    );
    expect(screen.queryByLabelText(/video available/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/cooking-tip-card.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`cooking-tip-card.tsx` (styled consistently with `recipe-card.tsx`):

```tsx
import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import type { CookingTipCard as CookingTipCardData } from "@/types/cooking-tip";

export function CookingTipCard({ tip }: { tip: CookingTipCardData }) {
  return (
    <article className="group relative flex h-full flex-col">
      <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-cream">
        {tip.imageUrl && (
          <Image src={tip.imageUrl} alt="" fill sizes="(min-width: 1280px) 25vw, (min-width: 640px) 45vw, 90vw" className="object-contain p-6" />
        )}
        {tip.hasVideo && (
          <span aria-label="Video available" className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white">
            <Play className="size-3.5 fill-current" aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-3 text-caption font-medium text-chilli">{tip.topicTag}</p>
      <h3 className="mt-1 text-h4 font-heading text-charcoal">
        <Link href={tip.href} className="after:absolute after:inset-0 hover:underline">
          {tip.title}
        </Link>
      </h3>
      <p className="mt-2 text-small text-charcoal/80">{tip.summary}</p>
    </article>
  );
}
```

`src/app/(storefront)/recipes/cooking-tips/page.tsx` — plain Server Component (per design decision 13), reads `searchParams` directly:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/storefront/layout/section";
import { CookingTipCard } from "@/components/storefront/recipes/cooking-tip-card";
import { cn } from "@/lib/utils";
import { listCookingTips, listCookingTipTopics } from "@/services/cooking-tip.service";
import { cookingTipListQuerySchema } from "@/validation/cooking-tip.schema";

export const metadata: Metadata = { title: "Cooking Tips" };

interface CookingTipsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CookingTipsPage({ searchParams }: CookingTipsPageProps) {
  const rawParams = await searchParams;
  const query = cookingTipListQuerySchema.parse({
    topic: typeof rawParams.topic === "string" ? rawParams.topic : undefined,
    page: rawParams.page,
  });
  const [result, topics] = await Promise.all([listCookingTips(query), listCookingTipTopics()]);

  return (
    <Section>
      <h1 className="text-h1 font-heading text-charcoal">Cooking Tips</h1>
      <nav aria-label="Filter by topic" className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/recipes/cooking-tips"
          className={cn("rounded-full border px-4 py-1.5 text-small", !query.topic ? "border-chilli bg-chilli text-white" : "border-input")}
        >
          All
        </Link>
        {topics.map(({ tag }) => (
          <Link
            key={tag}
            href={`/recipes/cooking-tips?topic=${tag}`}
            className={cn("rounded-full border px-4 py-1.5 text-small", query.topic === tag ? "border-chilli bg-chilli text-white" : "border-input")}
          >
            {tag}
          </Link>
        ))}
      </nav>
      {result.tips.length === 0 ? (
        <p className="mt-8 text-body text-charcoal/70">No cooking tips match that topic.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {result.tips.map((tip) => (
            <CookingTipCard key={tip.id} tip={tip} />
          ))}
        </div>
      )}
    </Section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/cooking-tip-card.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Manual verification**

`npm run dev`, visit `/recipes/cooking-tips`, confirm the grid renders, topic chips filter the list via a real navigation (URL changes), and a Draft tip never appears. Stop the dev server after.

- [ ] **Step 6: Commit**

```bash
git add src/components/storefront/recipes/cooking-tip-card.tsx "src/app/(storefront)/recipes/cooking-tips/page.tsx" tests/unit/cooking-tip-card.test.tsx
git commit -m "feat: add the cooking tips listing page"
```

---

## Task 11: `/recipes/cooking-tips/[slug]` detail page

**Files:**
- Create: `src/app/(storefront)/recipes/cooking-tips/[slug]/page.tsx`

**Interfaces:**
- Consumes: `getCookingTipBySlug` (Task 6), `VideoPlayer` (Task 8), `CookingTipCard` (Task 10).

- [ ] **Step 1: Implement**

No unit test for this task (Server Component page — per the established convention confirmed in STORY-018, pages aren't unit-tested; verified via manual check + Task 12's e2e).

```tsx
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Section } from "@/components/storefront/layout/section";
import { CookingTipCard } from "@/components/storefront/recipes/cooking-tip-card";
import { VideoPlayer } from "@/components/storefront/recipes/video-player";
import { getCookingTipBySlug } from "@/services/cooking-tip.service";

const getCachedTip = cache(getCookingTipBySlug);

interface CookingTipDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CookingTipDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tip = await getCachedTip(slug);
  if (!tip) return {};
  return { title: tip.title, description: tip.summary };
}

export default async function CookingTipDetailPage({ params }: CookingTipDetailPageProps) {
  const { slug } = await params;
  const tip = await getCachedTip(slug);
  if (!tip) notFound();

  return (
    <Section>
      <h1 className="text-h1 font-heading text-charcoal">{tip.title}</h1>
      <p className="mt-2 text-body text-charcoal/80">{tip.summary}</p>

      <div className="mt-6 max-w-2xl">
        {tip.video ? (
          <VideoPlayer video={tip.video} posterUrl={tip.imageUrl ?? "/images/products/export/curry-powder.webp"} posterAlt={tip.title} />
        ) : (
          tip.imageUrl && (
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-cream">
              <Image src={tip.imageUrl} alt="" fill className="object-cover" />
            </div>
          )
        )}
      </div>

      <div className="mt-6 max-w-2xl whitespace-pre-line text-body text-charcoal">{tip.bodyContent}</div>

      {tip.products.length > 0 && (
        <div className="mt-8">
          <h2 className="text-h4 font-heading text-charcoal">Products used</h2>
          <ul className="mt-2 flex flex-wrap gap-3">
            {tip.products.map((product) => (
              <li key={product.id}>
                <Link href={`/products/${product.slug}`} className="text-chilli underline-offset-2 hover:underline">
                  {product.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tip.relatedTips.length > 0 && (
        <div className="mt-10">
          <h2 className="text-h3 font-heading text-charcoal">Related tips</h2>
          <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-3">
            {tip.relatedTips.map((related) => (
              <CookingTipCard key={related.id} tip={related} />
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}
```

- [ ] **Step 2: Manual verification**

`npm run dev`, visit a seeded cooking tip's `/recipes/cooking-tips/<slug>` (both a video one and an image-only one), confirm rendering; visit a nonexistent slug and confirm 404; visit a Draft tip's slug directly and confirm 404. Stop the dev server after.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(storefront)/recipes/cooking-tips/[slug]/page.tsx"
git commit -m "feat: add the cooking tip detail page"
```

---

## Task 12: Playwright e2e coverage

**Files:**
- Create: `tests/e2e/video-recipes.spec.ts`
- Create: `tests/e2e/cooking-tips.spec.ts`

**Interfaces:**
- None — exercises the built app end-to-end.

- [ ] **Step 1: Write the e2e tests**

Before writing literal recipe/tip names, read the real seed data (`prisma/seed-recipes.ts`'s video-tagged recipes from Task 1 Step 5, and `prisma/seed-cooking-tips.ts` from Task 1 Step 6) — do not guess names. Mirror `tests/e2e/recipe-detail.spec.ts`'s conventions (real seed data, `page.request.get` for status checks, stubbing `window.print`-style browser APIs is not needed here, `@axe-core/playwright` for a11y).

`tests/e2e/video-recipes.spec.ts` — cover: visiting a video recipe's detail page shows a "Play video" button and no `iframe` before clicking (network tab / DOM check), clicking it mounts the iframe; `/recipes?hasVideo=true` lists only video recipes and each card shows the video badge; a non-video recipe's detail page shows the static hero image, no play button.

`tests/e2e/cooking-tips.spec.ts` — cover: `/recipes/cooking-tips` lists Published tips only (a seeded Draft tip's title never appears); clicking a topic chip filters via a real navigation and updates the URL; opening a tip detail page shows its body content and (for the seeded tip with a linked product) a working link to `/products/<slug>`; a nonexistent tip slug returns 404 via `page.request.get`; an axe scan of both the listing and a detail page has no violations.

- [ ] **Step 2: Run the e2e tests**

Reseed first (Vitest runs truncate the dev DB):

```bash
npx prisma db execute --file tests/unit/truncate-all.sql
npx tsx --env-file=.env prisma/seed.ts
```

Then:

```bash
npx playwright test tests/e2e/video-recipes.spec.ts tests/e2e/cooking-tips.spec.ts --reporter=list
```

Also re-run `tests/e2e/recipe-centre.spec.ts` and `tests/e2e/recipe-detail.spec.ts` as a regression check (this task adds a new filter and a new nav link that touch shared components) — do not modify either spec.

Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/video-recipes.spec.ts tests/e2e/cooking-tips.spec.ts
git commit -m "test: add Playwright e2e coverage for video recipes and cooking tips"
```

---

## Task 13: Documentation

**Files:**
- Modify: `docs/architecture-decisions.md`
- Modify: `docs/stories/04-recipes-food-academy/STORY-019-video-recipes-cooking-tips.md`

- [ ] **Step 1: Document the video/cooking-tip contracts**

Add an entry to `docs/architecture-decisions.md` (matching the file's existing per-story format): the supported video URL formats and provider detection (`normalizeVideoUrl`), the facade/lazy-load pattern and why (LCP protection, third-party embed cost), that `captionsUrl` only applies to `SelfHosted` video, that Cooking Tips lives at `/recipes/cooking-tips` (not `/food-academy/...`) per the blueprint's site structure, and that `CookingTipStatus` is intentionally a plain two-value enum (no moderation pipeline) since tips are admin-authored only — so future admin-console work (STORY-043/044) producing/consuming these URLs and statuses stays compatible.

- [ ] **Step 2: Mark the story done**

In `docs/stories/04-recipes-food-academy/STORY-019-video-recipes-cooking-tips.md`, change `**Status:** Draft` to `**Status:** Done`, check off every delivered acceptance criterion/task, and annotate the two AC items this plan resolves definitively: the route decision (note `/recipes/cooking-tips`, not Food Academy, with the blueprint citation) and the `/recipes/videos` vs `/recipes?type=video` choice (note the `hasVideo` filter approach and why, referencing design decision 2). Leave "Lighthouse >95" unchecked with an italic `_(not measured)_` note, matching STORY-018's precedent, unless it's actually measured during this work.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture-decisions.md "docs/stories/04-recipes-food-academy/STORY-019-video-recipes-cooking-tips.md"
git commit -m "docs: mark STORY-019 done; document video and cooking-tip contracts"
```

---

## Final Verification

- [ ] `npx eslint .` — 0 errors
- [ ] `npx next typegen && npx tsc --noEmit` — 0 errors
- [ ] `npx vitest run` (sharded per the memory note on PGlite load, or file-by-file) — all green
- [ ] `npx playwright test` — all green
- [ ] Manual check in the browser per Tasks 10/11's steps
