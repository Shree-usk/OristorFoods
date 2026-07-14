# STORY-019: Video Recipes & Cooking Tips

**Status:** Draft
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
- [ ] `Recipe` detail pages (STORY-018) that have an associated video render a video player in the hero/media area, supporting either an embedded provider (YouTube/Vimeo) or a self-hosted video URL (e.g. stored via the Media Library / CDN)
- [ ] Video player is lazy-loaded (does not block initial page load/LCP) and includes captions/subtitles track support where provided
- [ ] Recipes without an associated video render the existing static hero image (STORY-018 behavior unaffected)
- [ ] A new `/recipes/videos` (or `/recipes?type=video`) view lists all recipes that have video content, using the existing `RecipeCard` grid pattern from STORY-017, with a "video" badge/play icon overlay on applicable cards
- [ ] A new `CookingTip` content type exists with: title, slug, summary, video URL or image, body content (short-form, rich text), category/topic tag, related product references (optional), and `status` (DRAFT/PUBLISHED)
- [ ] `/food-academy/cooking-tips` (or `/recipes/cooking-tips`, per final nav decision) lists published cooking tips as a card grid, filterable by topic tag
- [ ] `/recipes/cooking-tips/[slug]` (or equivalent) renders a single cooking tip: video/image, body content, related tips, and any linked products
- [ ] Only `PUBLISHED` cooking tips are ever returned to the storefront
- [ ] Video and cooking-tip pages meet WCAG 2.1 AA (player has visible controls, keyboard-operable, captions where available; non-video fallback content is not solely conveyed by color/icon)
- [ ] Page performance: video embeds do not degrade Lighthoude/Core Web Vitals scores below the >95 target (facade/lazy-load pattern used for third-party embeds)

## Tasks

- [ ] **Database:**
  - [ ] Extend `Recipe` model with `videoUrl` (nullable), `videoProvider` (enum: YOUTUBE/VIMEO/SELF_HOSTED), `videoDurationSeconds` (nullable), `captionsUrl` (nullable)
  - [ ] Define `CookingTip` model: `id`, `slug`, `title`, `summary`, `bodyContent` (rich text/markdown), `videoUrl` (nullable), `videoProvider`, `imageUrl` (nullable), `topicTag`, `status`, `publishedAt`, `createdAt`, `updatedAt`
  - [ ] Define `CookingTipProductRef` join table (optional) linking tips to `Product` records (STORY-009) for tips like "how to store [product]"
  - [ ] Migration + seed data: a handful of recipes with `videoUrl` set, and 8–10 sample cooking tips across topic tags

- [ ] **API:**
  - [ ] `GET /api/recipes?type=video` (extend STORY-017's list endpoint with a `hasVideo` filter) or a dedicated `GET /api/recipes/videos`
  - [ ] `GET /api/cooking-tips` — list endpoint with `topicTag` filter and pagination
  - [ ] `GET /api/cooking-tips/[slug]` — single tip detail, `PUBLISHED` only, 404 otherwise

- [ ] **Service/Backend:**
  - [ ] Extend `recipe.service.ts` / `recipe.repository.ts` with `listVideoRecipes()` (or filter param) reusing STORY-017's query builder
  - [ ] New `cooking-tip.service.ts` + `cooking-tip.repository.ts`: `listCookingTips(filters, pagination)`, `getCookingTipBySlug(slug)`
  - [ ] Video URL normalization/validation helper (e.g. extract YouTube/Vimeo embed ID from a pasted URL) shared between recipe and cooking-tip services if authored content supplies raw share URLs

- [ ] **Frontend:**
  - [ ] `src/components/storefront/recipes/VideoPlayer.tsx` — Client Component wrapping the embed (YouTube/Vimeo iframe facade or `<video>` for self-hosted), lazy-loaded, with a poster/thumbnail click-to-play pattern to protect LCP
  - [ ] Integrate `VideoPlayer` into `RecipeHero.tsx` (from STORY-018) when `videoUrl` is present
  - [ ] `src/app/(storefront)/recipes/videos/page.tsx` — video recipe grid reusing `RecipeGrid`/`RecipeCard` with a video badge
  - [ ] `src/app/(storefront)/food-academy/cooking-tips/page.tsx` — cooking tips grid (`CookingTipCard.tsx`, topic filter chips)
  - [ ] `src/app/(storefront)/food-academy/cooking-tips/[slug]/page.tsx` — single tip detail page

- [ ] **Validation:**
  - [ ] Zod schema validating accepted video URL formats/providers at the API boundary
  - [ ] Zod schema for cooking-tip list/detail query params

- [ ] **Testing:**
  - [ ] Unit tests for the video URL/provider normalization helper (valid YouTube/Vimeo/self-hosted URLs, malformed URL rejection)
  - [ ] Unit tests confirming only `PUBLISHED` cooking tips are returned
  - [ ] Playwright e2e: open a recipe with video, confirm player renders and is click-to-play (not autoplaying, not blocking initial paint); browse `/recipes/videos`; open a cooking tip detail page
  - [ ] Accessibility test pass (axe) on the video player controls and cooking tip grid/detail pages

- [ ] **Documentation:**
  - [ ] Document supported video providers/URL formats and the lazy-load/facade pattern in `docs/architecture-decisions.md` so admin-side recipe/content authoring (STORY-043, STORY-044) produces compatible URLs
  - [ ] Note the final chosen route for Cooking Tips (`/recipes/cooking-tips` vs `/food-academy/cooking-tips`) once decided, and keep nav (STORY-004) in sync

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
