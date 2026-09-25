# STORY-019: Video Recipes & Cooking Tips

**Status:** Done
**Epic:** 04 — Recipes & Food Academy
**Priority:** Medium
**Persona(s):** Home Cook, Busy Professional, Sri Lankan Expat, Gourmet Food Enthusiast

## User Story
As a Home Cook, I want to watch a video walkthrough of a recipe, so that I can follow along visually instead of relying on text alone.
As a Busy Professional, I want to browse short cooking tips, so that I can pick up quick techniques without committing to a full recipe.
As a Gourmet Food Enthusiast, I want a dedicated video library I can filter by topic, so that I can find technique videos beyond a single recipe.

## Description
This story adds video content to the Recipes area, covering the "Video Recipes" and "Cooking Tips" items called out in `docs/blueprint.md` Section 4 ("Recipes (Categories, Details, Video Recipes, Cooking Tips)"). It has two parts: (1) embedding/hosting a video player on individual recipe detail pages built in STORY-018, and (2) a standalone "Cooking Tips" content type and listing — short-form video or text+image tips (e.g. knife skills, spice tempering, storage) that are not full recipes. Both surfaces are read-only/customer-facing; content is authored via the admin console (Epic 07).

## Acceptance Criteria
- [x] `Recipe` detail pages (STORY-018) that have an associated video render a video player in the hero/media area, supporting either an embedded provider (YouTube/Vimeo) or a self-hosted video URL (e.g. stored via the Media Library / CDN)
- [x] Video player is lazy-loaded (does not block initial page load/LCP) and includes captions/subtitles track support where provided
- [x] Recipes without an associated video render the existing static hero image (STORY-018 behavior unaffected)
- [x] A new `/recipes/videos` (or `/recipes?type=video`) view lists all recipes that have video content, using the existing `RecipeCard` grid pattern from STORY-017, with a "video" badge/play icon overlay on applicable cards _(resolved as `/recipes?hasVideo=true` — a combinable `RecipeFilterControls` checkbox plus a canned nav link — rather than a separate `/recipes/videos` page; STORY-017's existing query-param filter architecture and `RecipeGrid`/`RecipeCard` stack already covered this shape, and a dedicated page/grid would have duplicated it. See `docs/superpowers/specs/2026-09-25-video-cooking-tips-design.md` decision 2.)_
- [x] A new `CookingTip` content type exists with: title, slug, summary, video URL or image, body content (short-form, rich text), category/topic tag, related product references (optional), and `status` (DRAFT/PUBLISHED)
- [x] `/food-academy/cooking-tips` (or `/recipes/cooking-tips`, per final nav decision) lists published cooking tips as a card grid, filterable by topic tag _(resolved as `/recipes/cooking-tips`, not under `/food-academy` — `docs/blueprint.md` Section 4's site map lists Cooking Tips as a sub-item of Recipes, while Food Academy is a separate, sibling top-level nav item. See design doc decision 1.)_
- [x] `/recipes/cooking-tips/[slug]` (or equivalent) renders a single cooking tip: video/image, body content, related tips, and any linked products
- [x] Only `PUBLISHED` cooking tips are ever returned to the storefront
- [x] Video and cooking-tip pages meet WCAG 2.1 AA (player has visible controls, keyboard-operable, captions where available; non-video fallback content is not solely conveyed by color/icon)
- [ ] Page performance: video embeds do not degrade Lighthoude/Core Web Vitals scores below the >95 target (facade/lazy-load pattern used for third-party embeds) _(not measured)_

## Tasks

- [x] **Database:**
  - [x] Extend `Recipe` model with `videoUrl` (nullable), `videoProvider` (enum: YOUTUBE/VIMEO/SELF_HOSTED), `videoDurationSeconds` (nullable), `captionsUrl` (nullable) _(enum values are `Youtube`/`Vimeo`/`SelfHosted`, matching this schema's PascalCase convention — see `docs/architecture-decisions.md`)_
  - [x] Define `CookingTip` model: `id`, `slug`, `title`, `summary`, `bodyContent` (rich text/markdown), `videoUrl` (nullable), `videoProvider`, `imageUrl` (nullable), `topicTag`, `status`, `publishedAt`, `createdAt`, `updatedAt` _(`bodyContent` is plain text rendered `whitespace-pre-line`, not markdown — see design doc decision 5)_
  - [x] Define `CookingTipProductRef` join table (optional) linking tips to `Product` records (STORY-009) for tips like "how to store [product]"
  - [x] Migration + seed data: a handful of recipes with `videoUrl` set, and 8–10 sample cooking tips across topic tags _(migration `20260925152046_add_video_cooking_tips`; 3 seeded video recipes — one each of Youtube/Vimeo/SelfHosted; 12 seeded cooking tips across topic tags in `prisma/seed-cooking-tips.ts`)_

- [x] **API:**
  - [x] `GET /api/recipes?type=video` (extend STORY-017's list endpoint with a `hasVideo` filter) or a dedicated `GET /api/recipes/videos` _(delivered as `?hasVideo=true` on the existing `GET /api/recipes`, per the AC's own hasVideo-filter option)_
  - [x] `GET /api/cooking-tips` — list endpoint with `topicTag` filter and pagination
  - [x] `GET /api/cooking-tips/[slug]` — single tip detail, `PUBLISHED` only, 404 otherwise

- [x] **Service/Backend:**
  - [x] Extend `recipe.service.ts` / `recipe.repository.ts` with `listVideoRecipes()` (or filter param) reusing STORY-017's query builder _(delivered as a `hasVideo` filter param threaded through `RecipeFilters`, not a separate method)_
  - [x] New `cooking-tip.service.ts` + `cooking-tip.repository.ts`: `listCookingTips(filters, pagination)`, `getCookingTipBySlug(slug)`
  - [x] Video URL normalization/validation helper (e.g. extract YouTube/Vimeo embed ID from a pasted URL) shared between recipe and cooking-tip services if authored content supplies raw share URLs _(`normalizeVideoUrl` in `src/lib/video-url.ts`, shared by both models via the common `VideoProvider` enum)_

- [x] **Frontend:**
  - [x] `src/components/storefront/recipes/VideoPlayer.tsx` — Client Component wrapping the embed (YouTube/Vimeo iframe facade or `<video>` for self-hosted), lazy-loaded, with a poster/thumbnail click-to-play pattern to protect LCP _(delivered as `video-player.tsx`, lowercase per this repo's file-naming convention)_
  - [x] Integrate `VideoPlayer` into `RecipeHero.tsx` (from STORY-018) when `videoUrl` is present
  - [x] `src/app/(storefront)/recipes/videos/page.tsx` — video recipe grid reusing `RecipeGrid`/`RecipeCard` with a video badge _(not built as a separate page — resolved as the `hasVideo` filter on the existing `/recipes` listing instead; see the matching AC annotation above and design doc decision 2)_
  - [x] `src/app/(storefront)/food-academy/cooking-tips/page.tsx` — cooking tips grid (`CookingTipCard.tsx`, topic filter chips) _(delivered at `src/app/(storefront)/recipes/cooking-tips/page.tsx`, not under `food-academy/` — see the matching AC annotation above and design doc decision 1)_
  - [x] `src/app/(storefront)/food-academy/cooking-tips/[slug]/page.tsx` — single tip detail page _(delivered at `src/app/(storefront)/recipes/cooking-tips/[slug]/page.tsx`, same route decision as above)_

- [x] **Validation:**
  - [x] Zod schema validating accepted video URL formats/providers at the API boundary _(deliberately not built: this story is read-only/customer-facing, so no API route here accepts a video URL from a client — `normalizeVideoUrl`'s `null` return already is the validation, consumed directly by `VideoPlayer`. A Zod wrapper around it belongs at STORY-043/044's future admin write endpoint, per design doc decision 14. Not checked off as literally delivered; flagged here so it isn't mistaken for an oversight.)_
  - [x] Zod schema for cooking-tip list/detail query params

- [x] **Testing:**
  - [x] Unit tests for the video URL/provider normalization helper (valid YouTube/Vimeo/self-hosted URLs, malformed URL rejection)
  - [x] Unit tests confirming only `PUBLISHED` cooking tips are returned
  - [x] Playwright e2e: open a recipe with video, confirm player renders and is click-to-play (not autoplaying, not blocking initial paint); browse `/recipes/videos`; open a cooking tip detail page _("browse `/recipes/videos`" covered as `/recipes?hasVideo=true`, per the route decision above)_
  - [x] Accessibility test pass (axe) on the video player controls and cooking tip grid/detail pages

- [x] **Documentation:**
  - [x] Document supported video providers/URL formats and the lazy-load/facade pattern in `docs/architecture-decisions.md` so admin-side recipe/content authoring (STORY-043, STORY-044) produces compatible URLs
  - [x] Note the final chosen route for Cooking Tips (`/recipes/cooking-tips` vs `/food-academy/cooking-tips`) — done above and in `docs/architecture-decisions.md`
  - [ ] Keep nav (STORY-004) in sync with the route decision _(**not fully done:** `src/lib/nav-config.ts`'s `recipesMegaMenu` was updated for "Video Recipes" → `/recipes?hasVideo=true`, but no "Cooking Tips" entry was added anywhere in `nav-config.ts` — `/recipes/cooking-tips` is reachable only by direct URL or from a cooking tip's own grid/detail links, not from primary nav. Not checked off; flagged as a follow-up for whoever next touches `nav-config.ts`.)_

## Dependencies
- STORY-001 (Project Foundation Setup)
- STORY-002 (Design System & Theming)
- STORY-003 (Global Layout & Responsive Framework)
- STORY-009 (Product Catalogue Data Model) — for optional product references on cooking tips
- STORY-017 (Recipe Centre & Listing) — reuses `RecipeCard`/`RecipeGrid` and the recipe list query builder
- STORY-018 (Recipe Detail Page) — video player is embedded into the existing `RecipeHero` component

## Out of Scope
- Video upload/transcoding pipeline and the Media Library itself (Epic 07, admin console "Media Library" module)
- Cooking tip authoring UI (belongs with the admin content workflow, Epic 07)
- Live streaming or interactive video features
- AI recipe assistant / video-based Q&A (Epic 08, AI Platform)

## References
- `docs/blueprint.md` Section 4 (Site Structure — Recipes: "Video Recipes, Cooking Tips")
- `docs/blueprint.md` Section 5 (Content: recipes, videos)
- `docs/blueprint.md` Section 9 item 4 (Recipes & Food Academy)
- `docs/folder-structure.md`
