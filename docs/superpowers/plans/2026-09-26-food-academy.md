# STORY-020 Food Academy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new "Food Academy" educational content hub — a `/food-academy` listing page (featured entries + a category/content-type-filterable grid) and `/food-academy/[slug]` detail pages that render either a flat markdown article or a multi-section "course" with in-page navigation, with optional cross-links to Recipes and Products.

**Architecture:** New, independent content type (`FoodAcademyEntry`/`FoodAcademyCategory`/`FoodAcademySection` + two cross-link join tables) following the exact Service→Repository layering, Published-only invariant enforcement (AND-composed status filter, never a same-key spread), and Server-Component-by-default approach established by `CookingTip` in STORY-019. The one new architectural piece is `<MarkdownContent>`, a shared Server Component wrapping `react-markdown`, since this is the first markdown use in the codebase. Cross-links to Recipes/Products reuse existing service functions (`getProductsByIds`, and a new `getRecipesByIds` mirroring the existing `getRecipesByProductId`) rather than duplicating card-mapping logic — the Food Academy repository only ever stores/returns raw ids for these, never product/recipe fields directly.

**Tech Stack:** Next.js 16 Server/Client Components, Prisma 7 (`@prisma/adapter-pg`), Zod, Vitest, Playwright, Tailwind v4, `react-markdown` + `remark-gfm` (new dependency, first markdown use in this codebase).

**Spec:** `docs/superpowers/specs/2026-09-26-food-academy-design.md` (9 numbered design decisions this plan implements — data model, layering, frontend structure, SEO, accessibility, testing) and `docs/stories/04-recipes-food-academy/STORY-020-food-academy.md` (acceptance criteria/tasks). Executors read both.

## Global Constraints

- TypeScript strict mode — no `any`, no implicit types.
- Database access only through the Repository layer — routes/components call Services, Services call Repositories.
- Only `status: "Published"` Food Academy entries are ever visible on the storefront. Every published-facing query composes `status: "Published"` via `AND: [{ status: "Published" }, restWhere]`, stripping any caller-supplied `status` key first — never a same-key object spread (this exact bug shipped in STORY-019's first CookingTip repository draft and had to be fixed in a review round; get it right the first time here).
- Cross-linked products must only ever be Published — achieved for free by routing through `getProductsByIds` (already hardcodes `status: "Published"` via `buildProductListingWhere`), never by duplicating a product select in the Food Academy repository.
- Cross-linked recipes must only ever be Published — the new `findRecipesByIds` repository function must hardcode `status: "Published"`, mirroring `findRecipesByProductId`'s existing pattern exactly.
- Prisma enum values are PascalCase single words (`Draft`, `Published`, `Article`, `Guide`, `Course`).
- Every list query orders with a final tiebreaker on a unique column (existing pattern: recipe/cooking-tip queries always end `id: "asc"` or similar).
- `FoodAcademyEntry.bodyContent` and `FoodAcademySection.bodyContent` are markdown, rendered through the shared `<MarkdownContent>` component — never `dangerouslySetInnerHTML` directly, and raw HTML embedded in markdown source must not execute (react-markdown's default behavior — do not enable `rehype-raw`).
- `FoodAcademySection.sectionNumber` is unique per entry and 1-indexed; sections always render in that order.
- New Client Components stay isolated: `FoodAcademySectionNav` is the only new Client Component in this plan (the course table-of-contents). The hub and detail pages are Server Components with zero client JS beyond that one nav.
- `DATABASE_POOL_MAX=1` must be set in this worktree's `.env` (PGlite supports only one connection).
- Conventional Commits for every commit (`feat:`, `test:`, `fix:`, `docs:`).

## Review Focus

- **A Course entry with zero sections** (edge case the schema doesn't prevent) — the detail page and `FoodAcademySectionNav` must not crash; the page renders with an empty/absent section list and no broken table-of-contents. Covered in Task 9.
- **An entry linked to a Draft or Archived product** — `getEntryBySlug`'s related-products list must never surface it, exactly mirroring the bug found in STORY-019's final review (CookingTip's `productRefs` originally leaked non-Published products). This invariant is enforced at the service layer, not the repository layer — Task 4's repository intentionally never selects a product's `status` at all (it only ever returns the raw `productId`), so the leak-prevention lives entirely in Task 5's `getEntryBySlug` calling the already-Published-filtering `getProductsByIds`. Covered by Task 5's `getEntryBySlug` test, which links both a Draft and a Published product to the same entry and asserts only the Published one comes back.
- **A Course entry's `bodyContent` (the intro) is null** — the flat-article rendering path and the course rendering path share `<MarkdownContent>`, but the course path must handle a missing/empty intro gracefully (render nothing, not an empty markdown block or a crash). Covered in Task 8/9.
- **Markdown source containing raw HTML or script-like content** (`<script>alert(1)</script>`, an `onerror` attribute, a bare `javascript:` link) must render as inert literal text/attribute, never execute — the whole reason `<MarkdownContent>` exists as a shared, tested component rather than each page hand-rolling its own markdown call. Covered in Task 2.
- **Two entries in the same category but different statuses** — `findRelatedFoodAcademyEntries` and the category-filter chips must still only surface Published rows, not leak a Draft entry through the related-content or filter side door, mirroring the CookingTip precedent (Tasks 3 and 5) exactly.

---

## Task 1: Database — `FoodAcademyCategory`, `FoodAcademyEntry`, `FoodAcademySection`, ref tables

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_food_academy/migration.sql` (generated)
- Create: `prisma/seed-food-academy.ts`
- Modify: `prisma/seed.ts`

**Interfaces:**
- Produces: `enum FoodAcademyEntryStatus { Draft, Published }`; `enum FoodAcademyContentType { Article, Guide, Course }`; `FoodAcademyCategory { id, name, slug, description, sortOrder, status }`; `FoodAcademyEntry { id, slug, title, summary, heroImageUrl?, contentType, categoryId, bodyContent?, readingTimeMinutes?, authorName?, isFeatured, status, publishedAt?, createdAt, updatedAt }`; `FoodAcademySection { id, entryId, sectionNumber, title, bodyContent, imageUrl? }`; `FoodAcademyRecipeRef { id, entryId, recipeId }`; `FoodAcademyProductRef { id, entryId, productId }`. Later tasks' repository selects use these exact field names.

- [ ] **Step 1: Add the enums and models to `prisma/schema.prisma`**

Add near the other content-type enums (e.g. after `CookingTipStatus` if present, or after `RecipeDifficulty` if this worktree predates STORY-019):

```prisma
enum FoodAcademyEntryStatus {
  Draft
  Published
}

enum FoodAcademyContentType {
  Article
  Guide
  Course
}
```

Add the models (after the Recipe-related models, before Product Q&A/Reviews or wherever a new independent content type reads naturally):

```prisma
model FoodAcademyCategory {
  id          String               @id @default(cuid())
  name        String
  slug        String               @unique
  description String?
  sortOrder   Int                  @default(0)
  status      ContentStatus        @default(Active)
  entries     FoodAcademyEntry[]
}

model FoodAcademyEntry {
  id           String                  @id @default(cuid())
  slug         String                  @unique
  title        String
  summary      String
  heroImageUrl String?
  contentType  FoodAcademyContentType
  categoryId   String
  category     FoodAcademyCategory     @relation(fields: [categoryId], references: [id])
  // Markdown. Required in practice for Article/Guide, an optional short
  // intro for Course (whose real content lives in `sections`). There is no
  // create/update API in this story's scope — this is a seed-data
  // convention, not a runtime-validated one (mirrors CookingTip's
  // createCookingTip being seed-only).
  bodyContent  String?
  readingTimeMinutes Int?
  authorName   String?
  isFeatured   Boolean                 @default(false)
  status       FoodAcademyEntryStatus  @default(Draft)
  publishedAt  DateTime?
  createdAt    DateTime                @default(now())
  updatedAt    DateTime                @updatedAt

  sections    FoodAcademySection[]
  recipeRefs  FoodAcademyRecipeRef[]
  productRefs FoodAcademyProductRef[]

  @@index([status, publishedAt])
  @@index([status, categoryId])
  @@index([status, contentType])
  @@index([status, isFeatured])
}

model FoodAcademySection {
  id            String           @id @default(cuid())
  entryId       String
  entry         FoodAcademyEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  sectionNumber Int
  title         String
  bodyContent   String
  imageUrl      String?

  @@unique([entryId, sectionNumber])
}

model FoodAcademyRecipeRef {
  id       String           @id @default(cuid())
  entryId  String
  entry    FoodAcademyEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  recipeId String
  recipe   Recipe           @relation(fields: [recipeId], references: [id], onDelete: Cascade)

  @@unique([entryId, recipeId])
  @@index([recipeId])
}

model FoodAcademyProductRef {
  id        String           @id @default(cuid())
  entryId   String
  entry     FoodAcademyEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  productId String
  product   Product          @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([entryId, productId])
  @@index([productId])
}
```

Add the inverse relations on `Recipe` and `Product` (near their other reverse relations, e.g. `cookingTipRefs` on `Product` if present):

```prisma
  foodAcademyRefs FoodAcademyRecipeRef[]
```
(on `Recipe`)

```prisma
  foodAcademyRefs FoodAcademyProductRef[]
```
(on `Product`)

- [ ] **Step 2: Restart the local DB and generate the migration**

```bash
npx prisma migrate dev --name add_food_academy
```

If it fails with a PGlite lock/shadow-DB error, restart the dev DB server first (`npx prisma dev --detach --db-port 51214 --shadow-db-port 51215`, waiting ~15-20s after any prior kill), then retry. If `migrate dev` repeatably fails on the PGlite shadow-DB bug even after a restart, fall back to the documented offline-diff workaround: `git show HEAD:prisma/schema.prisma > /tmp/prev-schema.prisma && npx prisma migrate diff --from-schema-datamodel /tmp/prev-schema.prisma --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/<timestamp>_add_food_academy/migration.sql`, then `npx prisma db execute --file <that file>` to apply it, then `npx prisma migrate resolve --applied <timestamp>_add_food_academy`.

- [ ] **Step 3: Regenerate the Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 4: Create the Food Academy seed**

Create `prisma/seed-food-academy.ts`, following the structure of `prisma/seed-recipes.ts` (an array of category objects, an array of entry objects, a `seedFoodAcademy()` export). This worktree was forked from `master` before STORY-019 merged, so `prisma/seed-cooking-tips.ts` does not exist here — do not reference it; `seed-recipes.ts` is the only precedent file available. Requirements the seed data must satisfy (later tasks' tests depend on this exact shape):

- At least 4 categories (e.g. `"ingredients"`, `"techniques"`, `"culture-heritage"`, `"spice-guide"`), all `status: "Active"`.
- At least 2 standalone `Article`/`Guide` entries with real markdown `bodyContent` (headings, a list, a link) and `status: "Published"`.
- At least 1 `Course` entry with 3+ `FoodAcademySection` rows (sequential `sectionNumber` starting at 1), `status: "Published"`, cross-linked via `FoodAcademyRecipeRef` to a real seeded recipe slug and via `FoodAcademyProductRef` to a real seeded product slug (reuse the same `requireId`/product-lookup helper pattern already used in `seed-recipes.ts`). Give this Course entry `bodyContent: null` (no intro) — this is the seed data that exercises the "Course entry's intro is null" Review Focus item end-to-end (manual verification in Task 8/9, e2e in Task 10), since pages aren't unit-tested in this codebase's convention.
- At least 1 entry with `status: "Draft"` (to exercise the Published-only filter in later tests).
- At least 2 entries with `isFeatured: true`.
- A mix of `contentType` values across the Published entries (at least one each of `Article`, `Guide`, `Course`).

Export `seedFoodAcademy()` which creates the categories first, then the entries via `prisma.foodAcademyEntry.create` with nested `sections: { create: [...] }` (for the Course entry) and `recipeRefs`/`productRefs: { create: [...] }` where applicable.

- [ ] **Step 5: Wire the new seed into `prisma/seed.ts`**

Add `import { seedFoodAcademy } from "./seed-food-academy";` and, after the existing content-type seed calls, add `const foodAcademySeed = await seedFoodAcademy();`. Add `foodAcademy: foodAcademySeed,` to the final `console.log("Seed complete:", {...})` object, in the same style as the other content-type keys already there.

- [ ] **Step 6: Reseed and verify**

```bash
npx prisma db execute --file tests/unit/truncate-all.sql
npx tsx --env-file=.env prisma/seed.ts
```

Expected: exits 0, the "Seed complete:" log includes a `foodAcademy` key. Spot-check that the Course entry's sections come back in order, and that the Draft entry exists but won't appear in later storefront queries.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations prisma/seed-food-academy.ts prisma/seed.ts
git commit -m "feat: add the FoodAcademy content type (entries, categories, sections, cross-links)"
```

---

## Task 2: `MarkdownContent` shared component

**Files:**
- Create: `src/components/shared/markdown-content.tsx`
- Test: `tests/unit/markdown-content.test.tsx`

**Interfaces:**
- Consumes: nothing from other tasks (independent).
- Produces: `MarkdownContent({ content: string, className?: string }): JSX.Element`. Tasks 8 and 9 (detail page article/course rendering) import this.

- [ ] **Step 1: Install dependencies**

```bash
npm install react-markdown remark-gfm
```

- [ ] **Step 2: Write the failing tests**

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownContent } from "@/components/shared/markdown-content";

describe("MarkdownContent", () => {
  it("renders a heading, a list, and a link", () => {
    render(<MarkdownContent content={"## Storage tips\n\n- Keep cool\n- Keep dry\n\n[Read more](https://example.com)"} />);
    expect(screen.getByRole("heading", { level: 2, name: "Storage tips" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Read more" })).toHaveAttribute("href", "https://example.com");
  });

  it("does not execute raw HTML embedded in the markdown source", () => {
    render(<MarkdownContent content={'Before <script>window.__pwned = true;</script> after'} />);
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
    expect(document.querySelector("script[data-testid], script:not([type='application/ld+json'])")).not.toBeInTheDocument();
  });

  it("does not execute an event-handler attribute embedded in raw HTML", () => {
    render(<MarkdownContent content={'<img src="x" onerror="window.__pwned2 = true">'} />);
    expect((window as unknown as { __pwned2?: boolean }).__pwned2).toBeUndefined();
  });

  it("renders bold and italic emphasis", () => {
    render(<MarkdownContent content={"This is **bold** and this is *italic*."} />);
    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.getByText("italic").tagName).toBe("EM");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/unit/markdown-content.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Shared markdown renderer for Food Academy (and future content types).
 * react-markdown renders to React elements, not raw HTML strings, so raw
 * HTML embedded in the source (e.g. a pasted <script> tag) is emitted as
 * inert text, never executed — do not add rehype-raw, which would defeat
 * this.
 */
export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h2 className="text-h3 font-heading text-charcoal mt-8 mb-3">{children}</h2>,
          h2: ({ children }) => <h2 className="text-h4 font-heading text-charcoal mt-6 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-h5 font-heading text-charcoal mt-4 mb-2">{children}</h3>,
          p: ({ children }) => <p className="text-body text-charcoal mb-4">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-6 mb-4 text-body text-charcoal">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 text-body text-charcoal">{children}</ol>,
          a: ({ href, children }) => (
            <a href={href} className="text-chilli underline-offset-2 hover:underline">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
```

Note: `h1` is deliberately remapped to render as an `<h2>` — a markdown author writing `# Heading` inside body content must never produce a second page-level `<h1>`, which would break the page's heading hierarchy (the page itself owns the one `<h1>`, the entry's `title`).

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/markdown-content.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/components/shared/markdown-content.tsx tests/unit/markdown-content.test.tsx
git commit -m "feat: add the shared MarkdownContent renderer"
```

---

## Task 3: Food Academy types and validation schemas

**Files:**
- Create: `src/types/food-academy.ts`
- Create: `src/validation/food-academy.schema.ts`
- Test: `tests/unit/food-academy-schema.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `FoodAcademyEntryCard { id, slug, href, title, summary, heroImageUrl: string | null, contentType: "Article"|"Guide"|"Course", categoryName: string, categorySlug: string, readingTimeMinutes: number | null, isFeatured: boolean }`, `FoodAcademySectionData { id, sectionNumber, title, bodyContent, imageUrl: string | null }`, `FoodAcademyEntryDetail` (extends `FoodAcademyEntryCard` with `bodyContent: string | null`, `authorName: string | null`, `sections: FoodAcademySectionData[]`, `relatedRecipes: RecipePreview[]`, `relatedProducts: ProductListItem[]`, `relatedEntries: FoodAcademyEntryCard[]`), `FoodAcademyListResult { entries: FoodAcademyEntryCard[]; total: number; page: number; pageSize: number }`, `foodAcademyListQuerySchema`, `foodAcademySlugParamSchema`. Tasks 4-7 consume these.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from "vitest";
import { foodAcademyListQuerySchema, foodAcademySlugParamSchema } from "@/validation/food-academy.schema";

describe("foodAcademyListQuerySchema", () => {
  it("defaults page/pageSize and leaves category/contentType undefined when absent", () => {
    const result = foodAcademyListQuerySchema.parse({});
    expect(result).toMatchObject({ page: 1, pageSize: 12 });
    expect(result.category).toBeUndefined();
    expect(result.contentType).toBeUndefined();
  });

  it("passes through a category filter", () => {
    expect(foodAcademyListQuerySchema.parse({ category: "spice-guide" }).category).toBe("spice-guide");
  });

  it("only accepts a recognized contentType value", () => {
    expect(foodAcademyListQuerySchema.parse({ contentType: "Course" }).contentType).toBe("Course");
    expect(foodAcademyListQuerySchema.parse({ contentType: "not-a-real-type" }).contentType).toBeUndefined();
  });

  it("falls back to defaults for malformed page/pageSize", () => {
    expect(foodAcademyListQuerySchema.parse({ page: "not-a-number", pageSize: "-5" })).toMatchObject({ page: 1, pageSize: 12 });
  });
});

describe("foodAcademySlugParamSchema", () => {
  it("accepts a non-empty slug", () => {
    expect(foodAcademySlugParamSchema.safeParse({ slug: "spice-tempering-101" }).success).toBe(true);
  });
  it("rejects an empty slug", () => {
    expect(foodAcademySlugParamSchema.safeParse({ slug: "" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/food-academy-schema.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/types/food-academy.ts`:

```typescript
export interface FoodAcademyEntryCard {
  id: string;
  slug: string;
  href: string;
  title: string;
  summary: string;
  heroImageUrl: string | null;
  contentType: "Article" | "Guide" | "Course";
  categoryName: string;
  categorySlug: string;
  readingTimeMinutes: number | null;
  isFeatured: boolean;
}

export interface FoodAcademySectionData {
  id: string;
  sectionNumber: number;
  title: string;
  bodyContent: string;
  imageUrl: string | null;
}

export interface FoodAcademyEntryDetail extends FoodAcademyEntryCard {
  bodyContent: string | null;
  authorName: string | null;
  sections: FoodAcademySectionData[];
  relatedRecipes: import("@/services/product-detail-extensions").RecipePreview[];
  relatedProducts: import("@/types/product").ProductListItem[];
  relatedEntries: FoodAcademyEntryCard[];
}

export interface FoodAcademyListResult {
  entries: FoodAcademyEntryCard[];
  total: number;
  page: number;
  pageSize: number;
}
```

`src/validation/food-academy.schema.ts` (same `.catch()`-everywhere policy as `cookingTipListQuerySchema`):

```typescript
import { z } from "zod";

export const foodAcademyListQuerySchema = z.object({
  category: z.string().trim().min(1).optional().catch(undefined),
  contentType: z.enum(["Article", "Guide", "Course"]).optional().catch(undefined),
  page: z.coerce.number().int().positive().catch(1),
  pageSize: z.coerce.number().int().positive().max(48).catch(12),
});
export type FoodAcademyListQuery = z.infer<typeof foodAcademyListQuerySchema>;

export const foodAcademySlugParamSchema = z.object({
  slug: z.string().min(1),
});
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/food-academy-schema.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types/food-academy.ts src/validation/food-academy.schema.ts tests/unit/food-academy-schema.test.ts
git commit -m "feat: add Food Academy types and validation schemas"
```

---

## Task 4: Food Academy repository

**Files:**
- Create: `src/repositories/food-academy.repository.ts`
- Modify: `src/repositories/recipe.repository.ts` (add `findRecipesByIds`)
- Test: `tests/unit/food-academy-repository.test.ts`
- Modify: `tests/unit/recipe-fixtures.ts` (add `makeFoodAcademyCategory`/`makeFoodAcademyEntry` fixtures, matching the file's existing style)

**Interfaces:**
- Produces: `foodAcademyEntryCardSelect`, `FoodAcademyEntryCardRow`, `foodAcademyEntryDetailSelect`, `FoodAcademyEntryDetailRow`, `findPublishedFoodAcademyEntries(args: {where, skip, take}): Promise<{rows, total}>`, `findFeaturedFoodAcademyEntries(limit: number): Promise<FoodAcademyEntryCardRow[]>`, `findPublishedFoodAcademyEntryBySlug(slug: string): Promise<FoodAcademyEntryDetailRow | null>`, `findRelatedFoodAcademyEntries(entry: {id, categoryId}, limit: number): Promise<FoodAcademyEntryCardRow[]>`, `findActiveFoodAcademyCategories(): Promise<{id, name, slug}[]>`, `createFoodAcademyEntry(data: Prisma.FoodAcademyEntryUncheckedCreateInput)`; and on `recipe.repository.ts`, `findRecipesByIds(ids: string[], limit: number): Promise<RecipeCardRow[]>`. Task 5 (service) imports these.

**Design note carried from the spec:** `foodAcademyEntryDetailSelect`'s `recipeRefs`/`productRefs` select ONLY the raw `recipeId`/`productId` — never join into `Recipe`/`Product` fields here. Task 5's service resolves those ids through the existing `getRecipesByIds` (new, this task) and `getProductsByIds` (already exists in `product.service.ts`, already Published-only), so there is exactly one place in the codebase that decides what a "product card" or "recipe preview" looks like.

- [ ] **Step 1: Write the failing tests**

Add to `tests/unit/recipe-fixtures.ts`:

```typescript
export interface FoodAcademyCategoryOverrides {
  name?: string;
  slug?: string;
  status?: ContentStatus;
}

export function makeFoodAcademyCategory(overrides: FoodAcademyCategoryOverrides = {}) {
  const n = nextNumber();
  return prisma.foodAcademyCategory.create({
    data: {
      name: overrides.name ?? `Category ${n}`,
      slug: overrides.slug ?? `fa-category-${n}`,
      status: overrides.status ?? "Active",
    },
  });
}

export interface FoodAcademyEntryOverrides {
  slug?: string;
  title?: string;
  summary?: string;
  contentType?: "Article" | "Guide" | "Course";
  categoryId: string;
  bodyContent?: string | null;
  isFeatured?: boolean;
  status?: "Draft" | "Published";
  publishedAt?: Date | null;
  recipeIds?: string[];
  productIds?: string[];
  sections?: { sectionNumber: number; title: string; bodyContent: string }[];
}

export function makeFoodAcademyEntry(overrides: FoodAcademyEntryOverrides) {
  const n = nextNumber();
  return createFoodAcademyEntry({
    slug: overrides.slug ?? `fa-entry-${n}`,
    title: overrides.title ?? `Entry ${n}`,
    summary: overrides.summary ?? "A test entry.",
    contentType: overrides.contentType ?? "Article",
    categoryId: overrides.categoryId,
    bodyContent: overrides.bodyContent === undefined ? "Body content." : overrides.bodyContent,
    isFeatured: overrides.isFeatured ?? false,
    status: overrides.status ?? "Published",
    publishedAt: overrides.publishedAt === undefined ? new Date("2026-09-01T00:00:00Z") : overrides.publishedAt,
    recipeRefs: { create: (overrides.recipeIds ?? []).map((recipeId) => ({ recipeId })) },
    productRefs: { create: (overrides.productIds ?? []).map((productId) => ({ productId })) },
    sections: { create: overrides.sections ?? [] },
  });
}
```

Add `await prisma.foodAcademySection.deleteMany();`, `await prisma.foodAcademyRecipeRef.deleteMany();`, `await prisma.foodAcademyProductRef.deleteMany();`, `await prisma.foodAcademyEntry.deleteMany();`, `await prisma.foodAcademyCategory.deleteMany();` to `cleanupRecipes()` (deletes must run in this order, before `recipe.deleteMany()`/after — check the file's existing delete order and place these so cascade/FK constraints are satisfied; the ref tables and sections cascade-delete when their parent `FoodAcademyEntry` is deleted, so deleting `FoodAcademyEntry` before `FoodAcademyCategory` and before `recipe`/`product` cleanup is sufficient — no need to delete sections/refs explicitly if cascade is relied upon, but being explicit matches this file's existing style of one line per table).

`tests/unit/food-academy-repository.test.ts`:

```typescript
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { findRecipesByIds } from "@/repositories/recipe.repository";
import {
  findActiveFoodAcademyCategories,
  findFeaturedFoodAcademyEntries,
  findPublishedFoodAcademyEntries,
  findPublishedFoodAcademyEntryBySlug,
  findRelatedFoodAcademyEntries,
} from "@/repositories/food-academy.repository";
import { cleanupRecipes, makeCategory, makeFoodAcademyCategory, makeFoodAcademyEntry, makeRecipe } from "./recipe-fixtures";

afterEach(async () => {
  await cleanupRecipes();
  await prisma.product.deleteMany();
});

describe("findPublishedFoodAcademyEntries", () => {
  it("only returns Published entries, filtered by category and contentType when given", async () => {
    const category = await makeFoodAcademyCategory({ slug: "knife-skills" });
    const otherCategory = await makeFoodAcademyCategory({ slug: "storage" });
    await makeFoodAcademyEntry({ title: "Published Article", categoryId: category.id, contentType: "Article" });
    await makeFoodAcademyEntry({ title: "Draft Article", categoryId: category.id, status: "Draft" });
    await makeFoodAcademyEntry({ title: "Published Course", categoryId: category.id, contentType: "Course" });
    await makeFoodAcademyEntry({ title: "Other Category", categoryId: otherCategory.id });

    const all = await findPublishedFoodAcademyEntries({ where: {}, skip: 0, take: 10 });
    expect(all.rows.map((r) => r.title).sort()).toEqual(["Other Category", "Published Article", "Published Course"]);

    const byCategory = await findPublishedFoodAcademyEntries({ where: { categoryId: category.id }, skip: 0, take: 10 });
    expect(byCategory.rows.map((r) => r.title).sort()).toEqual(["Published Article", "Published Course"]);

    const byContentType = await findPublishedFoodAcademyEntries({ where: { contentType: "Course" }, skip: 0, take: 10 });
    expect(byContentType.rows.map((r) => r.title)).toEqual(["Published Course"]);
  });

  it("cannot be overridden by a caller-supplied status filter", async () => {
    const category = await makeFoodAcademyCategory();
    await makeFoodAcademyEntry({ title: "Real Published", categoryId: category.id });
    await makeFoodAcademyEntry({ title: "Sneaky Draft", categoryId: category.id, status: "Draft" });

    const result = await findPublishedFoodAcademyEntries({
      where: { status: "Draft" } as never,
      skip: 0,
      take: 10,
    });
    expect(result.rows.map((r) => r.title)).toEqual(["Real Published"]);
  });
});

describe("findFeaturedFoodAcademyEntries", () => {
  it("only returns featured, Published entries", async () => {
    const category = await makeFoodAcademyCategory();
    await makeFoodAcademyEntry({ title: "Featured Published", categoryId: category.id, isFeatured: true });
    await makeFoodAcademyEntry({ title: "Featured Draft", categoryId: category.id, isFeatured: true, status: "Draft" });
    await makeFoodAcademyEntry({ title: "Not Featured", categoryId: category.id, isFeatured: false });

    const featured = await findFeaturedFoodAcademyEntries(10);
    expect(featured.map((e) => e.title)).toEqual(["Featured Published"]);
  });
});

describe("findPublishedFoodAcademyEntryBySlug", () => {
  it("returns null for a missing or Draft slug", async () => {
    const category = await makeFoodAcademyCategory();
    await makeFoodAcademyEntry({ slug: "draft-entry", categoryId: category.id, status: "Draft" });
    expect(await findPublishedFoodAcademyEntryBySlug("draft-entry")).toBeNull();
    expect(await findPublishedFoodAcademyEntryBySlug("does-not-exist")).toBeNull();
  });

  it("returns sections in order and raw recipe/product ids", async () => {
    const category = await makeFoodAcademyCategory();
    const recipeCategory = await makeCategory();
    const recipe = await makeRecipe(recipeCategory.id);
    const product = await createProduct({ sku: "SKU-FA-1", slug: "curry-powder-fa", name: "Curry Powder" });

    await makeFoodAcademyEntry({
      slug: "knife-course",
      categoryId: category.id,
      contentType: "Course",
      recipeIds: [recipe.id],
      productIds: [product.id],
      sections: [
        { sectionNumber: 2, title: "Second", bodyContent: "..." },
        { sectionNumber: 1, title: "First", bodyContent: "..." },
        { sectionNumber: 3, title: "Third", bodyContent: "..." },
      ],
    });

    const result = await findPublishedFoodAcademyEntryBySlug("knife-course");
    expect(result?.sections.map((s) => s.title)).toEqual(["First", "Second", "Third"]);
    expect(result?.recipeRefs.map((r) => r.recipeId)).toEqual([recipe.id]);
    expect(result?.productRefs.map((r) => r.productId)).toEqual([product.id]);
  });
});

describe("findRelatedFoodAcademyEntries", () => {
  it("excludes the entry itself and only returns Published entries sharing the category", async () => {
    const category = await makeFoodAcademyCategory();
    const target = await makeFoodAcademyEntry({ slug: "target", categoryId: category.id });
    await makeFoodAcademyEntry({ slug: "same-category", categoryId: category.id });
    await makeFoodAcademyEntry({ slug: "draft-same-category", categoryId: category.id, status: "Draft" });
    const otherCategory = await makeFoodAcademyCategory();
    await makeFoodAcademyEntry({ slug: "other-category", categoryId: otherCategory.id });

    const related = await findRelatedFoodAcademyEntries({ id: target.id, categoryId: category.id }, 6);
    expect(related.map((r) => r.slug)).toEqual(["same-category"]);
  });
});

describe("findActiveFoodAcademyCategories", () => {
  it("returns Active categories, sorted by sortOrder", async () => {
    await makeFoodAcademyCategory({ name: "B" });
    await makeFoodAcademyCategory({ name: "A" });
    await prisma.foodAcademyCategory.create({ data: { name: "Inactive", slug: "inactive-cat", status: "Inactive" } });

    const categories = await findActiveFoodAcademyCategories();
    expect(categories.map((c) => c.name)).toEqual(["B", "A"]);
  });
});

describe("findRecipesByIds (recipe.repository.ts)", () => {
  it("only returns Published recipes matching the given ids", async () => {
    const recipeCategory = await makeCategory();
    const published = await makeRecipe(recipeCategory.id, { title: "Published Recipe" });
    const draft = await makeRecipe(recipeCategory.id, { title: "Draft Recipe", status: "Draft" });

    const results = await findRecipesByIds([published.id, draft.id], 10);
    expect(results.map((r) => r.title)).toEqual(["Published Recipe"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run tests/unit/food-academy-repository.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/repositories/food-academy.repository.ts`:

```typescript
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export const foodAcademyEntryCardSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  heroImageUrl: true,
  contentType: true,
  readingTimeMinutes: true,
  isFeatured: true,
  category: { select: { name: true, slug: true } },
} satisfies Prisma.FoodAcademyEntrySelect;

export type FoodAcademyEntryCardRow = Prisma.FoodAcademyEntryGetPayload<{ select: typeof foodAcademyEntryCardSelect }>;

export async function findPublishedFoodAcademyEntries(args: {
  where: Prisma.FoodAcademyEntryWhereInput;
  skip: number;
  take: number;
}): Promise<{ rows: FoodAcademyEntryCardRow[]; total: number }> {
  // Strip any caller-supplied `status` before composing: AND-ing a
  // conflicting status in would silently zero out results, and merging it
  // via spread would let a caller widen the Published-only invariant.
  const { status: _callerStatus, ...restWhere } = args.where;
  const where: Prisma.FoodAcademyEntryWhereInput = { AND: [{ status: "Published" }, restWhere] };
  const [rows, total] = await prisma.$transaction([
    prisma.foodAcademyEntry.findMany({
      where,
      orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
      skip: args.skip,
      take: args.take,
      select: foodAcademyEntryCardSelect,
    }),
    prisma.foodAcademyEntry.count({ where }),
  ]);
  return { rows, total };
}

export function findFeaturedFoodAcademyEntries(limit: number): Promise<FoodAcademyEntryCardRow[]> {
  return prisma.foodAcademyEntry.findMany({
    where: { status: "Published", isFeatured: true },
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
    take: limit,
    select: foodAcademyEntryCardSelect,
  });
}

export const foodAcademyEntryDetailSelect = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  heroImageUrl: true,
  contentType: true,
  readingTimeMinutes: true,
  isFeatured: true,
  bodyContent: true,
  authorName: true,
  categoryId: true,
  category: { select: { name: true, slug: true } },
  sections: {
    select: { id: true, sectionNumber: true, title: true, bodyContent: true, imageUrl: true },
    orderBy: { sectionNumber: "asc" },
  },
  // Raw ids only — Task 5 resolves these through recipe.service.ts's
  // getRecipesByIds and product.service.ts's getProductsByIds, both of
  // which already enforce Published-only. Do not join Recipe/Product
  // fields here; that would be a second place deciding what those cards
  // look like.
  recipeRefs: { select: { recipeId: true } },
  productRefs: { select: { productId: true } },
} satisfies Prisma.FoodAcademyEntrySelect;

export type FoodAcademyEntryDetailRow = Prisma.FoodAcademyEntryGetPayload<{ select: typeof foodAcademyEntryDetailSelect }>;

export function findPublishedFoodAcademyEntryBySlug(slug: string): Promise<FoodAcademyEntryDetailRow | null> {
  return prisma.foodAcademyEntry.findFirst({
    where: { slug, status: "Published" },
    select: foodAcademyEntryDetailSelect,
  });
}

export function findRelatedFoodAcademyEntries(
  entry: { id: string; categoryId: string },
  limit: number,
): Promise<FoodAcademyEntryCardRow[]> {
  return prisma.foodAcademyEntry.findMany({
    where: { status: "Published", id: { not: entry.id }, categoryId: entry.categoryId },
    orderBy: [{ publishedAt: { sort: "desc", nulls: "last" } }, { id: "asc" }],
    take: limit,
    select: foodAcademyEntryCardSelect,
  });
}

export function findActiveFoodAcademyCategories(): Promise<{ id: string; name: string; slug: string }[]> {
  return prisma.foodAcademyCategory.findMany({
    where: { status: "Active" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true },
  });
}

export function createFoodAcademyEntry(data: Prisma.FoodAcademyEntryUncheckedCreateInput) {
  return prisma.foodAcademyEntry.create({ data });
}
```

Add to `src/repositories/recipe.repository.ts` (near `findRecipesByProductId`):

```typescript
export function findRecipesByIds(ids: string[], limit: number): Promise<RecipeCardRow[]> {
  if (ids.length === 0) return Promise.resolve([]);
  return prisma.recipe.findMany({
    where: { status: "Published", id: { in: ids } },
    orderBy: buildRecipeOrderBy("popular"),
    take: limit,
    select: recipeCardSelect,
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run tests/unit/food-academy-repository.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/repositories/food-academy.repository.ts src/repositories/recipe.repository.ts tests/unit/food-academy-repository.test.ts tests/unit/recipe-fixtures.ts
git commit -m "feat: add the Food Academy repository and findRecipesByIds"
```

---

## Task 5: Food Academy service

**Files:**
- Create: `src/services/food-academy.service.ts`
- Modify: `src/services/recipe.service.ts` (add `getRecipesByIds`)
- Test: `tests/unit/food-academy-service.test.ts`

**Interfaces:**
- Consumes: Task 3's types, Task 4's repository functions, the existing `getProductsByIds` (`@/services/product.service`), and the new `getRecipesByIds` (this task, `@/services/recipe.service`).
- Produces: `listEntries(query: FoodAcademyListQuery): Promise<FoodAcademyListResult>`, `listFeaturedEntries(limit?: number): Promise<FoodAcademyEntryCard[]>`, `listCategories(): Promise<{id,name,slug}[]>`, `getEntryBySlug(slug: string): Promise<FoodAcademyEntryDetail | null>`; and on `recipe.service.ts`, `getRecipesByIds(ids: string[]): Promise<RecipePreview[]>`. Task 6 (routes) and the hub/detail pages call these.

- [ ] **Step 1: Write the failing test**

```typescript
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createStandardPrice } from "@/repositories/pricing.repository";
import { getEntryBySlug, listCategories, listEntries, listFeaturedEntries } from "@/services/food-academy.service";
import { getRecipesByIds } from "@/services/recipe.service";
import { cleanupRecipes, makeCategory, makeFoodAcademyCategory, makeFoodAcademyEntry, makeRecipe } from "./recipe-fixtures";

afterEach(async () => {
  await cleanupRecipes();
  await prisma.product.deleteMany();
});

describe("listEntries", () => {
  it("maps rows to FoodAcademyEntryCard and echoes page/pageSize", async () => {
    const category = await makeFoodAcademyCategory({ name: "Techniques", slug: "techniques" });
    await makeFoodAcademyEntry({ title: "Entry One", categoryId: category.id });

    const result = await listEntries({ page: 1, pageSize: 10 });
    expect(result).toMatchObject({ page: 1, pageSize: 10, total: 1 });
    expect(result.entries[0]).toMatchObject({
      title: "Entry One",
      categoryName: "Techniques",
      categorySlug: "techniques",
      href: expect.stringContaining("/food-academy/"),
    });
  });

  it("filters by category and contentType", async () => {
    const category = await makeFoodAcademyCategory({ slug: "spice-guide" });
    const other = await makeFoodAcademyCategory({ slug: "storage" });
    await makeFoodAcademyEntry({ title: "Spice Course", categoryId: category.id, contentType: "Course" });
    await makeFoodAcademyEntry({ title: "Storage Article", categoryId: other.id, contentType: "Article" });

    expect((await listEntries({ page: 1, pageSize: 10, category: "spice-guide" })).entries.map((e) => e.title)).toEqual(["Spice Course"]);
    expect((await listEntries({ page: 1, pageSize: 10, contentType: "Article" })).entries.map((e) => e.title)).toEqual(["Storage Article"]);
  });
});

describe("listFeaturedEntries", () => {
  it("returns only featured Published entries, up to the limit", async () => {
    const category = await makeFoodAcademyCategory();
    await makeFoodAcademyEntry({ title: "Featured", categoryId: category.id, isFeatured: true });
    await makeFoodAcademyEntry({ title: "Not Featured", categoryId: category.id, isFeatured: false });

    expect((await listFeaturedEntries()).map((e) => e.title)).toEqual(["Featured"]);
  });
});

describe("listCategories", () => {
  it("returns active categories", async () => {
    await makeFoodAcademyCategory({ name: "Ingredients" });
    expect((await listCategories()).map((c) => c.name)).toEqual(["Ingredients"]);
  });
});

describe("getEntryBySlug", () => {
  it("returns null for missing/Draft, maps sections/relatedRecipes/relatedProducts/relatedEntries for a real entry", async () => {
    expect(await getEntryBySlug("nope")).toBeNull();

    const category = await makeFoodAcademyCategory({ slug: "knife-skills" });
    const recipeCategory = await makeCategory();
    const recipe = await makeRecipe(recipeCategory.id, { title: "Knife Curry" });
    const draftProduct = await createProduct({ sku: "SKU-FA-2", slug: "draft-product-fa", name: "Draft Thing", status: "Draft" });
    // createProduct defaults status to "Draft" (schema.prisma), so this must be set explicitly
    // or the test would pass for the wrong reason (both products excluded, not just the Draft one).
    const publishedProduct = await createProduct({ sku: "SKU-FA-3", slug: "published-product-fa", name: "Real Thing", status: "Published" });
    // getProductsByIds silently drops any product with no resolvable price
    // (pricing.service.ts's resolvePricesForProducts) — without this, the
    // test would fail even with the status fix above, for an unrelated
    // reason (no price, not "not Published").
    await createStandardPrice({ product: { connect: { id: publishedProduct.id } }, price: "500.00" });

    await makeFoodAcademyEntry({ slug: "draft", categoryId: category.id, status: "Draft" });
    await makeFoodAcademyEntry({ slug: "related", categoryId: category.id });
    await makeFoodAcademyEntry({
      slug: "full",
      categoryId: category.id,
      recipeIds: [recipe.id],
      productIds: [draftProduct.id, publishedProduct.id],
      sections: [{ sectionNumber: 1, title: "Step One", bodyContent: "Do this." }],
    });

    expect(await getEntryBySlug("draft")).toBeNull();

    const result = await getEntryBySlug("full");
    expect(result?.sections).toEqual([{ id: expect.any(String), sectionNumber: 1, title: "Step One", bodyContent: "Do this.", imageUrl: null }]);
    expect(result?.relatedRecipes.map((r) => r.title)).toEqual(["Knife Curry"]);
    // The Draft product must never appear, even though it was linked.
    expect(result?.relatedProducts.map((p) => p.name)).toEqual(["Real Thing"]);
    expect(result?.relatedEntries.map((e) => e.slug)).toEqual(["related"]);
  });
});

describe("getRecipesByIds (recipe.service.ts)", () => {
  it("maps repository rows to RecipePreview shape, Published only", async () => {
    const recipeCategory = await makeCategory();
    const published = await makeRecipe(recipeCategory.id, { title: "Preview Recipe" });
    const draft = await makeRecipe(recipeCategory.id, { title: "Draft Recipe", status: "Draft" });

    const results = await getRecipesByIds([published.id, draft.id]);
    expect(results).toEqual([{ id: published.id, title: "Preview Recipe", slug: published.slug, imageSrc: expect.any(String) }]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/unit/food-academy-service.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Add to `src/services/recipe.service.ts` (near `getRecipesByProductId`):

```typescript
export async function getRecipesByIds(ids: string[]): Promise<RecipePreview[]> {
  if (ids.length === 0) return [];
  const rows = await recipeRepository.findRecipesByIds(ids, ids.length);
  return rows.map((row) => ({ id: row.id, title: row.title, slug: row.slug, imageSrc: row.heroImage }));
}
```

`src/services/food-academy.service.ts`:

```typescript
import * as foodAcademyRepository from "@/repositories/food-academy.repository";
import type { FoodAcademyEntryCardRow, FoodAcademyEntryDetailRow } from "@/repositories/food-academy.repository";
import { getRecipesByIds } from "@/services/recipe.service";
import { getProductsByIds } from "@/services/product.service";
import type { FoodAcademyEntryCard, FoodAcademyEntryDetail, FoodAcademyListResult } from "@/types/food-academy";
import type { FoodAcademyListQuery } from "@/validation/food-academy.schema";

function entryHref(slug: string): string {
  return `/food-academy/${slug}`;
}

function toEntryCard(row: FoodAcademyEntryCardRow): FoodAcademyEntryCard {
  return {
    id: row.id,
    slug: row.slug,
    href: entryHref(row.slug),
    title: row.title,
    summary: row.summary,
    heroImageUrl: row.heroImageUrl,
    contentType: row.contentType,
    categoryName: row.category.name,
    categorySlug: row.category.slug,
    readingTimeMinutes: row.readingTimeMinutes,
    isFeatured: row.isFeatured,
  };
}

export async function listEntries(query: FoodAcademyListQuery): Promise<FoodAcademyListResult> {
  const { page, pageSize, category, contentType } = query;
  const where = {
    ...(category ? { category: { slug: category } } : {}),
    ...(contentType ? { contentType } : {}),
  };
  const { rows, total } = await foodAcademyRepository.findPublishedFoodAcademyEntries({
    where,
    skip: (page - 1) * pageSize,
    take: pageSize,
  });
  return { entries: rows.map(toEntryCard), total, page, pageSize };
}

export async function listFeaturedEntries(limit = 4): Promise<FoodAcademyEntryCard[]> {
  const rows = await foodAcademyRepository.findFeaturedFoodAcademyEntries(limit);
  return rows.map(toEntryCard);
}

export function listCategories() {
  return foodAcademyRepository.findActiveFoodAcademyCategories();
}

export async function getEntryBySlug(slug: string): Promise<FoodAcademyEntryDetail | null> {
  const row: FoodAcademyEntryDetailRow | null = await foodAcademyRepository.findPublishedFoodAcademyEntryBySlug(slug);
  if (!row) return null;

  const [relatedEntryRows, relatedRecipes, relatedProducts] = await Promise.all([
    foodAcademyRepository.findRelatedFoodAcademyEntries({ id: row.id, categoryId: row.categoryId }, 6),
    getRecipesByIds(row.recipeRefs.map((ref) => ref.recipeId)),
    getProductsByIds(row.productRefs.map((ref) => ref.productId)),
  ]);

  return {
    ...toEntryCard(row),
    bodyContent: row.bodyContent,
    authorName: row.authorName,
    sections: row.sections,
    relatedRecipes,
    relatedProducts,
    relatedEntries: relatedEntryRows.map(toEntryCard),
  };
}
```

Note: `toEntryCard`'s parameter type (`FoodAcademyEntryCardRow`) doesn't structurally match `FoodAcademyEntryDetailRow`'s extra fields, but both selects share every field `toEntryCard` reads (`id, slug, title, summary, heroImageUrl, contentType, readingTimeMinutes, isFeatured, category.{name,slug}`) — if TypeScript complains when passing a detail row in, narrow the parameter type to just those shared fields (a small inline type), the same fallback Task 6 of STORY-019 anticipated for the equivalent CookingTip case.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/unit/food-academy-service.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/food-academy.service.ts src/services/recipe.service.ts tests/unit/food-academy-service.test.ts
git commit -m "feat: add the Food Academy service and getRecipesByIds"
```

---

## Task 6: API routes — `GET /api/food-academy`, `GET /api/food-academy/categories`, `GET /api/food-academy/[slug]`

**Files:**
- Create: `src/app/api/food-academy/route.ts`
- Create: `src/app/api/food-academy/categories/route.ts`
- Create: `src/app/api/food-academy/[slug]/route.ts`
- Test: `tests/unit/food-academy-route.test.ts`

**Interfaces:**
- Consumes: `listEntries`, `listCategories`, `getEntryBySlug` (Task 5), `foodAcademyListQuerySchema`, `foodAcademySlugParamSchema` (Task 3).

- [ ] **Step 1: Write the failing tests**

Read `src/app/api/recipes/route.ts` and `src/lib/api/responses.ts` first to match the exact established response-helper style (`serverErrorResponse` for the 500 path).

```typescript
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { GET as getEntries } from "@/app/api/food-academy/route";
import { GET as getCategories } from "@/app/api/food-academy/categories/route";
import { GET as getEntry } from "@/app/api/food-academy/[slug]/route";
import { cleanupRecipes, makeFoodAcademyCategory, makeFoodAcademyEntry } from "./recipe-fixtures";

afterEach(async () => {
  await cleanupRecipes();
});

describe("GET /api/food-academy", () => {
  it("returns Published entries with paging metadata", async () => {
    const category = await makeFoodAcademyCategory();
    await makeFoodAcademyEntry({ title: "Published Entry", categoryId: category.id });
    await makeFoodAcademyEntry({ title: "Draft Entry", categoryId: category.id, status: "Draft" });

    const response = await getEntries(new Request("http://localhost/api/food-academy"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.entries.map((e: { title: string }) => e.title)).toEqual(["Published Entry"]);
  });
});

describe("GET /api/food-academy/categories", () => {
  it("returns active categories", async () => {
    await makeFoodAcademyCategory({ name: "Ingredients" });
    const response = await getCategories(new Request("http://localhost/api/food-academy/categories"));
    expect(response.status).toBe(200);
    expect((await response.json()).map((c: { name: string }) => c.name)).toEqual(["Ingredients"]);
  });
});

describe("GET /api/food-academy/[slug]", () => {
  it("returns 200 for a Published slug, 404 for missing/Draft", async () => {
    const category = await makeFoodAcademyCategory();
    await makeFoodAcademyEntry({ slug: "published-entry", categoryId: category.id });
    await makeFoodAcademyEntry({ slug: "draft-entry", categoryId: category.id, status: "Draft" });

    const ok = await getEntry(new Request("http://localhost/api/food-academy/published-entry"), {
      params: Promise.resolve({ slug: "published-entry" }),
    });
    expect(ok.status).toBe(200);

    const draftResponse = await getEntry(new Request("http://localhost/api/food-academy/draft-entry"), {
      params: Promise.resolve({ slug: "draft-entry" }),
    });
    expect(draftResponse.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run tests/unit/food-academy-route.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`src/app/api/food-academy/route.ts`:

```typescript
import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { listEntries } from "@/services/food-academy.service";
import { foodAcademyListQuerySchema } from "@/validation/food-academy.schema";

export async function GET(request: Request) {
  const query = foodAcademyListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  try {
    return NextResponse.json(await listEntries(query));
  } catch (error) {
    return serverErrorResponse(error, "GET /api/food-academy");
  }
}
```

`src/app/api/food-academy/categories/route.ts`:

```typescript
import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { listCategories } from "@/services/food-academy.service";

export async function GET() {
  try {
    return NextResponse.json(await listCategories());
  } catch (error) {
    return serverErrorResponse(error, "GET /api/food-academy/categories");
  }
}
```

`src/app/api/food-academy/[slug]/route.ts` (same shape as `src/app/api/recipes/[slug]/route.ts`):

```typescript
import { NextResponse } from "next/server";

import { getEntryBySlug } from "@/services/food-academy.service";
import { foodAcademySlugParamSchema } from "@/validation/food-academy.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = foodAcademySlugParamSchema.parse(await params);

  const entry = await getEntryBySlug(slug);
  if (!entry) {
    return NextResponse.json({ error: "Food Academy entry not found" }, { status: 404 });
  }

  return NextResponse.json(entry, { status: 200 });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run tests/unit/food-academy-route.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/food-academy tests/unit/food-academy-route.test.ts
git commit -m "feat: add GET /api/food-academy, /categories, and /[slug]"
```

---

## Task 7: `FoodAcademyCard` and the `/food-academy` hub page

**Files:**
- Create: `src/components/storefront/food-academy/food-academy-card.tsx`
- Create: `src/app/(storefront)/food-academy/page.tsx`
- Test: `tests/unit/food-academy-card.test.tsx`

**Interfaces:**
- Consumes: `listEntries`, `listFeaturedEntries`, `listCategories` (Task 5), `FoodAcademyEntryCard` type (Task 3).

- [ ] **Step 1: Write the failing test**

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FoodAcademyCard } from "@/components/storefront/food-academy/food-academy-card";

describe("FoodAcademyCard", () => {
  it("links to the entry's detail page and shows the contentType badge", () => {
    render(
      <FoodAcademyCard
        entry={{ id: "1", slug: "knife-basics", href: "/food-academy/knife-basics", title: "Knife Basics", summary: "Learn the grip.", heroImageUrl: "/img.webp", contentType: "Guide", categoryName: "Techniques", categorySlug: "techniques", readingTimeMinutes: 5, isFeatured: false }}
      />,
    );
    expect(screen.getByRole("link", { name: /knife basics/i })).toHaveAttribute("href", "/food-academy/knife-basics");
    expect(screen.getByText("Guide")).toBeInTheDocument();
    expect(screen.getByText(/5 min/i)).toBeInTheDocument();
  });

  it("omits the reading time when null", () => {
    render(
      <FoodAcademyCard
        entry={{ id: "2", slug: "no-time", href: "/food-academy/no-time", title: "No Time", summary: "...", heroImageUrl: null, contentType: "Article", categoryName: "Culture", categorySlug: "culture", readingTimeMinutes: null, isFeatured: false }}
      />,
    );
    expect(screen.queryByText(/min/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/unit/food-academy-card.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`food-academy-card.tsx` (styled consistently with `recipe-card.tsx`):

```tsx
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { FoodAcademyEntryCard as FoodAcademyEntryCardData } from "@/types/food-academy";

export function FoodAcademyCard({ entry }: { entry: FoodAcademyEntryCardData }) {
  return (
    <article className="group relative flex h-full flex-col">
      <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-cream">
        {entry.heroImageUrl && (
          <Image
            src={entry.heroImageUrl}
            alt=""
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 640px) 45vw, 90vw"
            className="object-cover"
          />
        )}
        <Badge className="absolute top-2 left-2">{entry.contentType}</Badge>
      </div>
      <p className="mt-3 text-caption font-medium text-chilli">{entry.categoryName}</p>
      <h3 className="mt-1 text-h4 font-heading text-charcoal">
        <Link href={entry.href} className="after:absolute after:inset-0 hover:underline">
          {entry.title}
        </Link>
      </h3>
      <p className="mt-2 text-small text-charcoal/80">{entry.summary}</p>
      {entry.readingTimeMinutes !== null && (
        <p className="mt-2 text-caption text-charcoal/60">{entry.readingTimeMinutes} min read</p>
      )}
    </article>
  );
}
```

`src/app/(storefront)/food-academy/page.tsx` — plain Server Component, per the spec's Section 6:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/storefront/layout/section";
import { FoodAcademyCard } from "@/components/storefront/food-academy/food-academy-card";
import { ItemListJsonLd } from "@/components/storefront/product/item-list-json-ld";
import { cn } from "@/lib/utils";
import { listCategories, listEntries, listFeaturedEntries } from "@/services/food-academy.service";
import { foodAcademyListQuerySchema } from "@/validation/food-academy.schema";

export const metadata: Metadata = {
  title: "Food Academy",
  description: "Learn authentic Sri Lankan ingredients, techniques, and food culture with Oristor's Food Academy.",
  alternates: { canonical: "/food-academy" },
};

const CONTENT_TYPES = ["Article", "Guide", "Course"] as const;

interface FoodAcademyPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function FoodAcademyPage({ searchParams }: FoodAcademyPageProps) {
  const rawParams = await searchParams;
  const query = foodAcademyListQuerySchema.parse({
    category: typeof rawParams.category === "string" ? rawParams.category : undefined,
    contentType: typeof rawParams.contentType === "string" ? rawParams.contentType : undefined,
    page: rawParams.page,
  });
  const [result, categories, featured] = await Promise.all([
    listEntries(query),
    listCategories(),
    query.category || query.contentType ? Promise.resolve([]) : listFeaturedEntries(),
  ]);

  return (
    <Section>
      <h1 className="text-h1 font-heading text-charcoal">Food Academy</h1>

      {featured.length > 0 && (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {featured.map((entry) => (
            <FoodAcademyCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      <nav aria-label="Filter by category" className="mt-8 flex flex-wrap gap-2">
        <Link
          href="/food-academy"
          aria-current={!query.category ? "page" : undefined}
          className={cn("rounded-full border px-4 py-1.5 text-small", !query.category ? "border-chilli bg-chilli text-white" : "border-input")}
        >
          All
        </Link>
        {categories.map((category) => (
          <Link
            key={category.slug}
            href={`/food-academy?category=${encodeURIComponent(category.slug)}`}
            aria-current={query.category === category.slug ? "page" : undefined}
            className={cn("rounded-full border px-4 py-1.5 text-small", query.category === category.slug ? "border-chilli bg-chilli text-white" : "border-input")}
          >
            {category.name}
          </Link>
        ))}
      </nav>
      <nav aria-label="Filter by content type" className="mt-2 flex flex-wrap gap-2">
        {CONTENT_TYPES.map((contentType) => (
          <Link
            key={contentType}
            href={`/food-academy?contentType=${encodeURIComponent(contentType)}`}
            aria-current={query.contentType === contentType ? "page" : undefined}
            className={cn("rounded-full border px-4 py-1.5 text-small", query.contentType === contentType ? "border-chilli bg-chilli text-white" : "border-input")}
          >
            {contentType}
          </Link>
        ))}
      </nav>

      <h2 id="food-academy-results-heading" className="sr-only">
        Food Academy results
      </h2>
      {result.entries.length === 0 ? (
        <p className="mt-8 text-body text-charcoal/70">No Food Academy entries match that filter.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {result.entries.map((entry) => (
            <FoodAcademyCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
      <ItemListJsonLd items={result.entries.map((entry) => ({ href: entry.href, name: entry.title }))} />
    </Section>
  );
}
```

Note: the featured section is suppressed once a filter is active (`query.category || query.contentType`) — showing an unrelated "featured" row above a filtered grid would be confusing; this matches how a filtered view should read as "just the filtered results."

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/unit/food-academy-card.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Manual verification**

`npm run dev`, visit `/food-academy`, confirm featured entries + grid render, category/contentType chips filter via real navigation (URL changes, featured section disappears once filtered), and a Draft entry never appears. Stop the dev server after.

- [ ] **Step 6: Commit**

```bash
git add src/components/storefront/food-academy/food-academy-card.tsx "src/app/(storefront)/food-academy/page.tsx" tests/unit/food-academy-card.test.tsx
git commit -m "feat: add the Food Academy hub listing page"
```

---

## Task 8: `/food-academy/[slug]` detail page — Article/Guide rendering, metadata, structured data, related-content blocks

**Files:**
- Create: `src/app/(storefront)/food-academy/[slug]/page.tsx`
- Create: `src/components/storefront/food-academy/food-academy-json-ld.tsx`
- Create: `src/components/storefront/food-academy/related-recipes-block.tsx`
- Create: `src/components/storefront/food-academy/related-products-block.tsx`
- Test: `tests/unit/related-recipes-block.test.tsx`
- Test: `tests/unit/related-products-block.test.tsx`

**Interfaces:**
- Consumes: `getEntryBySlug` (Task 5), `FoodAcademyCard` (Task 7), `MarkdownContent` (Task 2), `Breadcrumbs` (existing, `@/components/storefront/layout/breadcrumbs`), `ProductCard` (existing, `@/components/storefront/product/product-card`), `RecipePreview` (existing, `@/services/product-detail-extensions`).
- Produces: `RelatedRecipesBlock({ recipes: RecipePreview[] }): JSX.Element | null`, `RelatedProductsBlock({ products: ProductListItem[] }): JSX.Element | null`. The page renders correctly for Article/Guide entries. Course-specific section rendering is added in Task 9 — this task's page must not crash on a Course entry (it just won't show sections yet; Task 9 adds that).

**Design note:** `RecipePreview` (`{id, title, slug, imageSrc}`, from `product-detail-extensions.ts`) is deliberately minimal and does NOT carry every field `RecipeCard`'s real prop type requires (`categoryName`, `avgRating`, `ratingCount`, etc.) — so `RelatedRecipesBlock` is its own small presentation component, not a wrapper that forces `RecipePreview` through `RecipeCard`'s full prop shape. `ProductListItem` (what `getProductsByIds` already returns), by contrast, satisfies `ProductCard`'s prop type exactly — so `RelatedProductsBlock` is a thin wrapper that renders `ProductCard` directly, no data-shape gap to work around.

- [ ] **Step 1: Write the failing tests for the two block components**

```typescript
// tests/unit/related-recipes-block.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RelatedRecipesBlock } from "@/components/storefront/food-academy/related-recipes-block";

describe("RelatedRecipesBlock", () => {
  it("renders a heading and a link per recipe", () => {
    render(
      <RelatedRecipesBlock
        recipes={[
          { id: "1", title: "Chicken Curry", slug: "chicken-curry", imageSrc: "/curry.webp" },
          { id: "2", title: "Dhal", slug: "dhal", imageSrc: "/dhal.webp" },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: /recipes to try/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /chicken curry/i })).toHaveAttribute("href", "/recipes/chicken-curry");
    expect(screen.getByRole("link", { name: /dhal/i })).toHaveAttribute("href", "/recipes/dhal");
  });

  it("renders nothing when there are no related recipes", () => {
    const { container } = render(<RelatedRecipesBlock recipes={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

```typescript
// tests/unit/related-products-block.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RelatedProductsBlock } from "@/components/storefront/food-academy/related-products-block";

const product = {
  id: "1",
  name: "Roasted Curry Powder",
  href: "/products/roasted-curry-powder",
  imageSrc: "/curry-powder.webp",
  imageAlt: "Roasted Curry Powder",
  price: 850,
  currency: "LKR",
  inStock: true,
};

describe("RelatedProductsBlock", () => {
  it("renders a heading and a ProductCard per product", () => {
    render(<RelatedProductsBlock products={[product]} />);
    expect(screen.getByRole("heading", { name: /products used/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /roasted curry powder/i })).toHaveAttribute("href", "/products/roasted-curry-powder");
  });

  it("renders nothing when there are no related products", () => {
    const { container } = render(<RelatedProductsBlock products={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/unit/related-recipes-block.test.tsx tests/unit/related-products-block.test.tsx
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the block components**

`related-recipes-block.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";
import type { RecipePreview } from "@/services/product-detail-extensions";

export function RelatedRecipesBlock({ recipes }: { recipes: RecipePreview[] }) {
  if (recipes.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="text-h4 font-heading text-charcoal">Recipes to try</h2>
      <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {recipes.map((recipe) => (
          <Link key={recipe.id} href={`/recipes/${recipe.slug}`} className="group block">
            <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-cream">
              <Image src={recipe.imageSrc} alt="" fill className="object-contain p-6" />
            </div>
            <p className="mt-2 text-small font-medium text-charcoal group-hover:underline">{recipe.title}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

`related-products-block.tsx`:

```tsx
import { ProductCard } from "@/components/storefront/product/product-card";
import type { ProductListItem } from "@/types/product";

export function RelatedProductsBlock({ products }: { products: ProductListItem[] }) {
  if (products.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="text-h4 font-heading text-charcoal">Products used</h2>
      <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/related-recipes-block.test.tsx tests/unit/related-products-block.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Implement the detail page**

No unit test for the page itself (Server Component page — established convention per STORY-018/019: pages aren't unit-tested directly; verified via manual check + Task 10's e2e).

`food-academy-json-ld.tsx`:

```tsx
import { JsonLdScript } from "@/components/storefront/product/json-ld-script";

interface FoodAcademyJsonLdProps {
  name: string;
  description: string;
  imageUrl: string | null;
  authorName: string | null;
  isCourse: boolean;
}

export function FoodAcademyJsonLd({ name, description, imageUrl, authorName, isCourse }: FoodAcademyJsonLdProps) {
  const json = {
    "@context": "https://schema.org",
    "@type": isCourse ? "LearningResource" : "Article",
    name,
    headline: name,
    description,
    ...(imageUrl ? { image: imageUrl } : {}),
    ...(authorName ? { author: { "@type": "Person", name: authorName } } : {}),
  };

  return <JsonLdScript data={json} />;
}
```

`src/app/(storefront)/food-academy/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Breadcrumbs } from "@/components/storefront/layout/breadcrumbs";
import { Section } from "@/components/storefront/layout/section";
import { FoodAcademyCard } from "@/components/storefront/food-academy/food-academy-card";
import { FoodAcademyJsonLd } from "@/components/storefront/food-academy/food-academy-json-ld";
import { RelatedRecipesBlock } from "@/components/storefront/food-academy/related-recipes-block";
import { RelatedProductsBlock } from "@/components/storefront/food-academy/related-products-block";
import { MarkdownContent } from "@/components/shared/markdown-content";
import { getEntryBySlug } from "@/services/food-academy.service";

const getCachedEntry = cache(getEntryBySlug);

interface FoodAcademyDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: FoodAcademyDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getCachedEntry(slug);
  if (!entry) return {};
  return {
    title: entry.title,
    description: entry.summary,
    alternates: { canonical: `/food-academy/${slug}` },
  };
}

export default async function FoodAcademyDetailPage({ params }: FoodAcademyDetailPageProps) {
  const { slug } = await params;
  const entry = await getCachedEntry(slug);
  if (!entry) notFound();

  return (
    <Section>
      <Breadcrumbs items={[{ name: "Food Academy", href: "/food-academy" }, { name: entry.title, href: entry.href }]} />
      <FoodAcademyJsonLd
        name={entry.title}
        description={entry.summary}
        imageUrl={entry.heroImageUrl}
        authorName={entry.authorName}
        isCourse={entry.contentType === "Course"}
      />

      <h1 className="mt-4 text-h1 font-heading text-charcoal">{entry.title}</h1>
      <p className="mt-2 text-body text-charcoal/80">{entry.summary}</p>
      {entry.authorName && <p className="mt-1 text-caption text-charcoal/60">By {entry.authorName}</p>}
      {entry.readingTimeMinutes !== null && (
        <p className="mt-1 text-caption text-charcoal/60">{entry.readingTimeMinutes} min read</p>
      )}

      {entry.heroImageUrl && (
        <div className="relative mt-6 aspect-video w-full overflow-hidden rounded-lg bg-cream">
          <Image src={entry.heroImageUrl} alt="" fill className="object-cover" />
        </div>
      )}

      {entry.bodyContent && (
        <div className="mt-6 max-w-2xl">
          <MarkdownContent content={entry.bodyContent} />
        </div>
      )}

      {/* Course section rendering + FoodAcademySectionNav added in Task 9 */}

      <RelatedRecipesBlock recipes={entry.relatedRecipes} />
      <RelatedProductsBlock products={entry.relatedProducts} />

      {entry.relatedEntries.length > 0 && (
        <div className="mt-10">
          <h2 className="text-h3 font-heading text-charcoal">Related reading</h2>
          <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-3">
            {entry.relatedEntries.map((related) => (
              <FoodAcademyCard key={related.id} entry={related} />
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}
```

- [ ] **Step 6: Manual verification**

`npm run dev`, visit a seeded Article/Guide entry's `/food-academy/<slug>`, confirm rendering (title, markdown body, breadcrumbs, related blocks where applicable); visit a nonexistent slug and confirm 404; visit the Draft entry's slug directly and confirm 404. Stop the dev server after.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(storefront)/food-academy/[slug]/page.tsx" src/components/storefront/food-academy/food-academy-json-ld.tsx src/components/storefront/food-academy/related-recipes-block.tsx src/components/storefront/food-academy/related-products-block.tsx tests/unit/related-recipes-block.test.tsx tests/unit/related-products-block.test.tsx
git commit -m "feat: add the Food Academy detail page (Article/Guide rendering, related-content blocks)"
```

---

## Task 9: Course section rendering and `FoodAcademySectionNav`

**Files:**
- Create: `src/components/storefront/food-academy/food-academy-section-nav.tsx` (Client Component)
- Modify: `src/app/(storefront)/food-academy/[slug]/page.tsx` (render `sections` for Course entries)
- Test: `tests/unit/food-academy-section-nav.test.tsx`

**Interfaces:**
- Consumes: `FoodAcademySectionData[]` (Task 3), `MarkdownContent` (Task 2).
- Produces: `FoodAcademySectionNav({ sections: {sectionNumber, title}[] }): JSX.Element`.

- [ ] **Step 1: Write the failing tests**

```typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FoodAcademySectionNav } from "@/components/storefront/food-academy/food-academy-section-nav";

describe("FoodAcademySectionNav", () => {
  it("renders a keyboard-focusable anchor link per section, in order", () => {
    render(
      <FoodAcademySectionNav
        sections={[
          { sectionNumber: 1, title: "Gather your tools" },
          { sectionNumber: 2, title: "Make the cut" },
        ]}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Gather your tools", "Make the cut"]);
    expect(links[0]).toHaveAttribute("href", "#section-1");
    expect(links[1]).toHaveAttribute("href", "#section-2");
  });

  it("renders nothing for an empty section list", () => {
    const { container } = render(<FoodAcademySectionNav sections={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/unit/food-academy-section-nav.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
"use client";

interface FoodAcademySectionNavProps {
  sections: { sectionNumber: number; title: string }[];
}

/**
 * Plain anchor-link table of contents, sticky-positioned via CSS. No
 * active-section scroll-spy highlighting in v1 — that needs scroll
 * listeners/IntersectionObserver for a nice-to-have the AC doesn't
 * require (the actual bar is "keyboard-operable," which plain anchor
 * links satisfy for free).
 */
export function FoodAcademySectionNav({ sections }: FoodAcademySectionNavProps) {
  if (sections.length === 0) return null;

  return (
    <nav aria-label="Course sections" className="sticky top-24 hidden w-56 shrink-0 lg:block">
      <ol className="flex flex-col gap-2 border-l border-input pl-4 text-small">
        {sections.map((section) => (
          <li key={section.sectionNumber}>
            <a href={`#section-${section.sectionNumber}`} className="text-charcoal/70 hover:text-chilli">
              {section.title}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
```

Now modify `src/app/(storefront)/food-academy/[slug]/page.tsx`: replace the `{/* Course section rendering + FoodAcademySectionNav added in Task 9 */}` comment with:

```tsx
      {entry.contentType === "Course" && entry.sections.length > 0 && (
        <div className="mt-6 flex gap-8">
          <FoodAcademySectionNav sections={entry.sections} />
          <div className="min-w-0 flex-1 space-y-10">
            {entry.sections.map((section) => (
              <div key={section.id} id={`section-${section.sectionNumber}`}>
                <h2 className="text-h3 font-heading text-charcoal">{section.title}</h2>
                {section.imageUrl && (
                  <div className="relative mt-4 aspect-video w-full overflow-hidden rounded-lg bg-cream">
                    <Image src={section.imageUrl} alt="" fill className="object-cover" />
                  </div>
                )}
                <div className="mt-4 max-w-2xl">
                  <MarkdownContent content={section.bodyContent} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
```

And add the import: `import { FoodAcademySectionNav } from "@/components/storefront/food-academy/food-academy-section-nav";`

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/unit/food-academy-section-nav.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Manual verification**

`npm run dev`, visit the seeded Course entry's detail page, confirm the sticky section nav renders, each link scrolls to (and its `href` matches) the correct section heading, and tab-key navigation reaches every nav link and every section heading in order. Stop the dev server after.

- [ ] **Step 6: Commit**

```bash
git add src/components/storefront/food-academy/food-academy-section-nav.tsx "src/app/(storefront)/food-academy/[slug]/page.tsx" tests/unit/food-academy-section-nav.test.tsx
git commit -m "feat: add Course section rendering and the section table of contents"
```

---

## Task 10: Playwright e2e coverage

**Files:**
- Create: `tests/e2e/food-academy.spec.ts`

**Interfaces:**
- None — exercises the built app end-to-end.

- [ ] **Step 1: Write the e2e tests**

Before writing literal entry/category names, read the real seed data (`prisma/seed-food-academy.ts` from Task 1) — do not guess names. Mirror `tests/e2e/cooking-tips.spec.ts`'s conventions if this worktree has it (STORY-019), otherwise `tests/e2e/recipe-detail.spec.ts`'s (real seed data, `page.request.get` for status checks, `@axe-core/playwright` for a11y).

`tests/e2e/food-academy.spec.ts` — cover: `/food-academy` lists Published entries only (the seeded Draft entry's title never appears) and shows the featured row; clicking a category chip and a contentType chip each filter via a real navigation and update the URL; opening the seeded Article/Guide entry shows its body content; opening the seeded Course entry (whose `bodyContent` is seeded as `null`, per Task 1) shows its section nav and each section's content, and does NOT render an empty/broken intro block above the sections (the Review Focus item this seed choice exists to exercise); clicking a nav link is keyboard-operable (verify via `page.keyboard.press("Tab")` reaching a nav link, or a direct click plus URL-hash check); following a related-recipe link lands on `/recipes/[slug]`; following a related-product link lands on `/products/[slug]`; a nonexistent entry slug returns 404 via `page.request.get`; an axe scan of the hub page, the Article/Guide detail page, and the Course detail page each have no violations.

- [ ] **Step 2: Run the e2e tests**

Reseed first (Vitest runs truncate the dev DB):

```bash
npx prisma db execute --file tests/unit/truncate-all.sql
npx tsx --env-file=.env prisma/seed.ts
```

Then:

```bash
npx playwright test tests/e2e/food-academy.spec.ts --reporter=list
```

Also re-run `tests/e2e/recipe-centre.spec.ts` and `tests/e2e/recipe-detail.spec.ts` as a regression check (this task's Task 4/5 additions touch `recipe.repository.ts`/`recipe.service.ts`, both shared with those specs) — do not modify either spec.

Expected: all PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/food-academy.spec.ts
git commit -m "test: add Playwright e2e coverage for Food Academy"
```

---

## Task 11: Documentation

**Files:**
- Modify: `docs/architecture-decisions.md`
- Modify: `docs/stories/04-recipes-food-academy/STORY-020-food-academy.md`

- [ ] **Step 1: Document the Food Academy contracts**

Add an entry to `docs/architecture-decisions.md` (matching the file's existing per-story format): the `ARTICLE`/`GUIDE`/`COURSE` content-type distinction and how `bodyContent` (flat types) vs `sections` (Course) split the content model; that `<MarkdownContent>` is the shared, reusable markdown renderer going forward (raw HTML disabled by default — do not add `rehype-raw` without re-examining the sanitization implications); that `FoodAcademyEntryStatus` is intentionally a plain two-value enum (no moderation pipeline) since entries are admin-authored only, same rationale as `CookingTipStatus`; and the `FoodAcademyRecipeRef`/`FoodAcademyProductRef` cross-link pattern (raw-id-only repository selects, resolved through `getRecipesByIds`/`getProductsByIds` in the service layer) for reuse by future content types (e.g. Blog, STORY-021).

- [ ] **Step 2: Mark the story done**

In `docs/stories/04-recipes-food-academy/STORY-020-food-academy.md`, change `**Status:** Draft` to `**Status:** Done`, check off every delivered acceptance criterion/task, cross-referencing the actual committed code (do not check off anything not actually delivered — if you find an AC this plan didn't cover, flag it explicitly rather than checking it off). Leave "Lighthouse >95" unchecked with an italic `_(not measured)_` note, matching STORY-018/019's precedent, unless it's actually measured during this work.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture-decisions.md "docs/stories/04-recipes-food-academy/STORY-020-food-academy.md"
git commit -m "docs: mark STORY-020 done; document Food Academy contracts"
```

---

## Final Verification

- [ ] `npx eslint .` — 0 errors
- [ ] `npx next typegen && npx tsc --noEmit` — 0 errors
- [ ] `npx vitest run` (sharded per the memory note on PGlite load, or file-by-file) — all green
- [ ] `npx playwright test` — all green
- [ ] Manual check in the browser per Tasks 7/8/9's steps
