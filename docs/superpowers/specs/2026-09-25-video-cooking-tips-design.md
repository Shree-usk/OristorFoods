# STORY-019 Video Recipes & Cooking Tips — Design Decisions

Resolves the implementation choices `docs/stories/04-recipes-food-academy/STORY-019-video-recipes-cooking-tips.md`
leaves open, and records the existing codebase patterns this story reuses.

## 1. Cooking Tips route: `/recipes/cooking-tips`, not `/food-academy/cooking-tips`

The story explicitly flags this as undecided. It's resolved by the project's
own binding spec: `docs/blueprint.md` Section 4's site map lists
`Recipes (Categories, Details, Video Recipes, Cooking Tips)` — Cooking Tips
is a sub-item of Recipes — while **Food Academy is a separate, sibling
top-level nav item** (`primaryNavItems` in `src/lib/nav-config.ts` already
has both `Recipes` and `Food Academy` as distinct entries). So:
`/recipes/cooking-tips` (list) and `/recipes/cooking-tips/[slug]` (detail).

## 2. Video Recipes listing: extend `/recipes`, not a separate `/recipes/videos` page

The AC offers both options explicitly ("`/recipes/videos` (or
`/recipes?type=video`)"). STORY-017 already built a URL-driven,
query-param filter architecture for `/recipes`
(`recipe-listing-values.ts` → `recipe-listing.schema.ts` →
`recipe-listing-params.ts` → `RecipeListing`/`RecipeFilterControls`), and
`product-listing-params.ts` already has an exact precedent for a boolean
filter of this shape: `inStock: parseAsBoolean` (nuqs) /
`z.enum(["true","false"]).transform(...)` (zod). Adding `hasVideo` the
same way and reusing the existing `RecipeGrid`/`RecipeCard`/`RecipeListing`
stack satisfies the AC ("uses the existing RecipeCard grid pattern") without
a second page, a second grid component, or a second query-building path —
a dedicated `/recipes/videos/page.tsx` would duplicate all of that. The
nav-config mega-menu already has a placeholder comment
(`// "Video Recipes" returns with STORY-019`) pointing at exactly this: a
canned filter link, same idiom as the existing "Quick & Easy" link
(`/recipes?difficulty=easy&time=under-15,15-30`). "Video Recipes" becomes
`/recipes?hasVideo=true`.

## 3. Video embed: provider facade (YouTube/Vimeo) + native `<video>` (self-hosted)

`ProductVideo`/`ProductGallery` already render self-hosted video via a plain
`<video>` element — reused for `videoProvider: SELF_HOSTED`. YouTube/Vimeo
need genuinely new code: a **lazy-load facade** (click-to-play poster image;
the real iframe only mounts on click) is the standard pattern for protecting
LCP with third-party embeds, and is what AC "lazy-loaded... does not block
initial page load/LCP" and "facade/lazy-load pattern used for third-party
embeds" ask for by name.

- `normalizeVideoUrl(rawUrl)` in `src/lib/video-url.ts`: accepts a pasted
  YouTube (`youtube.com/watch?v=`, `youtu.be/`, `youtube.com/embed/`) or
  Vimeo (`vimeo.com/<id>`, `player.vimeo.com/video/<id>`) share URL, or a
  direct file URL, and returns `{ provider: "YOUTUBE"|"VIMEO"|"SELF_HOSTED",
  embedId: string | null, url: string } | null` (null = unrecognized/invalid).
  This is the "video URL normalization/validation helper" the task list asks
  for, shared by the Zod schema (API/admin boundary) and by `VideoPlayer`
  (rendering).
- `VideoPlayer` (Client Component): for YOUTUBE/VIMEO, renders a poster
  (YouTube: `https://i.ytimg.com/vi/{id}/hqdefault.jpg`, no extra fetch
  needed; Vimeo has no unauthenticated thumbnail endpoint, so it renders a
  generic play-button overlay on a solid background) with a Play button;
  clicking swaps in the real `<iframe src=".../embed/{id}?autoplay=1">`. For
  SELF_HOSTED, renders `<video src={url} controls poster={...}>` directly
  (native video already lazy-loads by default; no facade needed) — matching
  `ProductGallery`'s existing `<video>` styling.

## 4. Captions: self-hosted only

`Recipe.captionsUrl` only makes sense for `SELF_HOSTED` video: a `<video>`
element accepts `<track kind="captions" src={captionsUrl}>`, but a
cross-origin YouTube/Vimeo `<iframe>` cannot have a caption track injected
into it (captions for those come from the provider's own UI, outside this
app's control). `VideoPlayer` only renders the `<track>` when
`provider === "SELF_HOSTED" && captionsUrl`.

## 5. `CookingTip.bodyContent`: plain text, not markdown/rich-text

No markdown-rendering dependency exists anywhere in this codebase yet, and
STORY-018's `ChefNotes` already established the pattern for this project of
storing "rich text" fields as plain strings rendered with
`whitespace-pre-line` (a gap the STORY-018 final review flagged as a
follow-up, not fixed then). Introducing a markdown parser for one field in
one story would be a new dependency for a single, non-critical content
field — YAGNI. `CookingTip.bodyContent` is `String`, rendered with
`whitespace-pre-line` so authored line breaks survive (applying the
STORY-018 follow-up here too, not just noting it).

## 6. `CookingTipProductRef`: simple join, no reverse PDP provider

AC "`/recipes/cooking-tips/[slug]` renders... any linked products" requires
showing linked products **on the tip**, which only needs a forward query
(tip → products). No AC asks for a "cooking tips about this product"
section on the Product Detail Page (unlike STORY-018's recipe↔product
reverse lookup, which STORY-011 explicitly consumes). So: a plain
`CookingTipProductRef(cookingTipId, productId)` join, a repository query
that includes linked products when fetching a tip, and no
`registerRecipeSummaryProvider`-style extension point — building one now
would be speculative, unused scope.

## 7. Related tips: same pattern as STORY-018's related recipes

`getRelatedTips`: Published tips sharing `topicTag`, excluding self, newest
first, capped at a small count (6, matching `getRelatedRecipes`'s limit).
No AC specifies an exact count or matching dimension beyond "related tips."

## 8. Recipe video fields land on the existing `Recipe` model

The AC is explicit: "`Recipe` detail pages... render a video player... when
present." `videoUrl`, `videoProvider`, `videoDurationSeconds`, `captionsUrl`
are added directly to `Recipe` (all nullable) — no sub-model, matching how
STORY-018 already put nutrition/chefNotes flat on `Recipe` rather than in a
sub-model, for the same reason (one-to-one data, not aggregate/child rows).

## 9. `RecipeHero` gains video, doesn't fork

`RecipeHero` (STORY-018) renders the hero image + gallery thumbnails. When a
recipe has `videoUrl`, `VideoPlayer` replaces the hero image slot (poster =
the existing `heroImage`), keeping the gallery thumbnail strip below
unchanged. Recipes without video render exactly as STORY-018 left them (AC
"unaffected").

## 10a. `CookingTipStatus`: a new, minimal two-value enum

The AC is explicit: `status (DRAFT/PUBLISHED)`. Existing status enums in
this schema are all bigger because they model a moderation pipeline for
*customer-submitted* content (`ReviewStatus`/`QuestionStatus`: Pending →
Approved/Rejected → Published) or a multi-stage authoring pipeline
(`RecipeStatus`: Draft → Review → Approved → Published → Archived).
Cooking tips are admin-authored directly (task list: "Cooking tip authoring
UI... Epic 07"), with no customer-submission or review stage described
anywhere in this story — reusing a 5-value workflow enum would model stages
that never occur. New enum: `enum CookingTipStatus { Draft Published }`.
Naming matches this schema's own convention (`enum` values are PascalCase
single words — `Draft`, `Published`, `Easy` — not the story text's
shorthand `DRAFT`/`PUBLISHED`). Same convention applies to the video
provider enum: `enum VideoProvider { Youtube Vimeo SelfHosted }` (not
`YOUTUBE`/`VIMEO`/`SELF_HOSTED`).

## 10. `RecipeCard` video badge

`RecipeCard.hasVideo: boolean` (new field on the existing `RecipeCard` type,
alongside `avgRating`/`difficulty`) drives a small `Play` icon badge
(same `lucide-react` `Play` icon `ProductGallery` already uses) overlaid on
the card's image corner when true. No new card component.

## 12. "Has Video" also gets a real filter checkbox

Every other listing filter (difficulty, time, diet) is both a) reachable
via a canned URL link and b) a combinable, visible checkbox in
`RecipeFilterControls`. Making `hasVideo` URL-only (reachable solely via
the nav's "Video Recipes" link) would be a discoverability dead-end: a
customer already filtering by category/difficulty would have no way to
also narrow to "has video" without leaving and re-navigating. Add a "Has
Video" `CheckboxOption` to `RecipeFilterControls` alongside the existing
ones, so it composes with every other filter exactly like they do.

## 13. Cooking Tips listing: plain server-rendered page, no client filter state

The AC's only filter dimension for cooking tips is `topicTag` (single-select,
not combinable with anything else) — unlike `/recipes`, there's no search
box, no multi-select filters, and no debounced input. The whole reason
`/recipes` needs client-side URL state (`nuqs`) is to keep a search box's
typed value in sync without a full navigation per keystroke (a real,
previously-hit race condition — see `recipe-listing.tsx`'s `searchInput`
local-state fix). None of that applies here. `/recipes/cooking-tips` reads
`topic` straight from the Server Component's `searchParams` prop and
renders topic chips as plain `<Link href="?topic=...">`s (same pattern as
category chips elsewhere) — a full Server Component page, zero client JS,
and an entire category of bugs (debounce races, URL-sync edge cases) that
doesn't get a chance to exist.

## 14. No Zod schema wraps `normalizeVideoUrl` in this story

The story's task list asks for "a Zod schema validating accepted video URL
formats/providers at the API boundary." This story is explicitly
read-only/customer-facing ("content is authored via the admin console,
Epic 07") — no API in this story accepts a video URL from a client; video
fields are only ever read, never written by anything built here. Building
a Zod wrapper now with no caller would be speculative, unused code.
`normalizeVideoUrl`'s `null` return already IS the validation (Task 2),
consumed directly by `VideoPlayer`. When STORY-043 adds an admin write
endpoint for `Recipe.videoUrl`/`CookingTip.videoUrl`, it can wrap this
same function in `z.string().refine((url) => normalizeVideoUrl(url) !==
null)` at that boundary — the reusable piece already exists.
