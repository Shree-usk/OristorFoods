# STORY-023 Downloads & Resources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/downloads` library of downloadable PDF resources (nutrition guides, ingredient glossaries, etc.) with server-tracked download counts, plus an on-demand "Download printable recipe card (PDF)" action on the recipe detail page.

**Architecture:** Two independent slices sharing no code, per the design spec's ground rule. `DownloadResource`/`DownloadCategory` back a generic static-file library (`download.service.ts` → `download.repository.ts` → Prisma), served through a route that reads the file from `public/downloads/` and streams it with `Content-Disposition: attachment`, atomically incrementing `downloadCount` the same way `Recipe.viewCount` already increments. `recipe-pdf.service.ts` is unrelated: it calls the existing `getRecipeBySlug` (STORY-018) and renders a `@react-pdf/renderer` document fresh on every request — no new model, no caching.

**Tech Stack:** Next.js 16 App Router / Server Components, TypeScript strict, Prisma 7 + `@prisma/adapter-pg`, Zod, `@react-pdf/renderer` (new), `@fontsource/inter`/`@fontsource/cormorant-garamond` (new, font files for PDF embedding), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-27-downloads-resources-design.md` (read this first — every model field, function name, route path, and component name below is taken directly from it). Also authoritative: `docs/stories/04-recipes-food-academy/STORY-023-downloads-resources.md` (acceptance criteria).

## Global Constraints

- **Never call Prisma directly outside a repository.** `download.repository.ts` is the only file that imports `@/lib/db`'s `prisma` for `DownloadResource`/`DownloadCategory`.
- **`fileUrl`/`thumbnailUrl` are plain relative paths into `public/`** — no cloud storage in this story (spec decision #1). `/api/downloads/[slug]/file` reads via `fs.readFile`, never a redirect (spec decision #5).
- **`downloadCount` only ever changes via `incrementDownloadCount`'s raw `$executeRaw` UPDATE** (`download.repository.ts`), mirroring `recipe.repository.ts`'s `incrementRecipeViewCount` exactly — never `prisma.downloadResource.update()`.
- **A generated recipe PDF is not a `DownloadResource` row.** `recipe-pdf.service.ts` never writes to the `DownloadResource` table and has no counter (spec decision #3/#7).
- **No `GET /api/downloads/[slug]` detail endpoint** — dropped from the story's original task list as unused surface (spec decision #4). Do not add it.
- **`DownloadResourceStatus` enum values are PascalCase** (`Draft`/`Published`/`Archived`), matching every other status enum in this schema (`RecipeStatus`, `BlogPostStatus`, `RecipeReviewStatus`) — never the story text's SCREAMING_CASE.
- **Migration workflow:** use `npx prisma db push` for iteration; produce the real committed migration via the offline `migrate diff --from-schema/--to-schema --script` recipe in Task 1, never `migrate dev` (see `docs/architecture-decisions.md`, STORY-001/STORY-012 entries).
- **`DATABASE_POOL_MAX=1` must be set in this worktree's `.env`** (PGlite supports only one connection). Already set — verify with `cat .env | grep DATABASE_POOL_MAX` before Task 1.
- **Run `npx tsc --noEmit -p tsconfig.json` and `npm run lint` before committing each task.** Run the task's own test file with `npx vitest run <pattern>` before moving to the next task (do not run the full `npm run test` suite mid-plan — this project's PGlite dev server is documented to wedge under sustained load; run the full suite only once, at the end, restarting `npx prisma dev` first).

## Review Focus

- **A `requiresAuth` resource must return 401 to an unauthenticated file request, not a 200 with the file bytes.** The single most security-relevant behavior in this story — pinned by a route test in Task 5 that asserts the response status AND that no `Content-Disposition` header is present (proving the file body was never sent).
- **An unpublished (`Draft`/`Archived`) resource's file must 404 on direct access to `/api/downloads/[slug]/file`, even though a caller could guess or previously-know the slug.** The listing endpoint filtering to `Published` only protects discovery, not direct access — Task 5 tests both paths independently.
- **A `DownloadResource` row whose `fileUrl` points at a file that doesn't exist on disk must 404 cleanly, never throw an unhandled `fs` exception that surfaces as a raw 500.** Explicitly called out in the AC ("fail gracefully... rather than a broken download or generic 500") — Task 5 tests this with a resource seeded to point at a nonexistent path.
- **`recipe-pdf.service.ts` must not crash for a recipe missing every optional field** (no dietary tags, `chefNotes: null`, no video, `cuisine: null`, `avgRating: null`) — a recipe this sparse is a completely normal, valid state (STORY-018's own type marks all of these nullable), and a PDF renderer that assumes a field is always present is the kind of bug that only surfaces on real content, not the happy-path recipe used while building it. Task 6 tests this explicitly with a minimal recipe fixture.
- **Two concurrent downloads of the same resource must both be counted — `downloadCount` must not lose an increment.** Task 3's repository test exercises this the same way `Recipe.viewCount`'s own precedent is verified: asserting the raw-SQL increment shape, plus a test issuing two increments and confirming the final count is correct (this project's `DATABASE_POOL_MAX=1` means these serialize at the connection-pool level rather than truly racing, which still exercises the correctness property that matters — the raw UPDATE recomputes from the stored value rather than incrementing a stale in-memory number).

---

## Task 1: Dependencies, Prisma schema, and migration

**Files:**
- Modify: `package.json`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_download_resources/migration.sql`

**Interfaces:**
- Produces: `@react-pdf/renderer`, `@fontsource/inter`, `@fontsource/cormorant-garamond` as installed dependencies; `DownloadResourceStatus` enum (`Draft`, `Published`, `Archived`); `DownloadCategory` model (`id`, `name`, `slug`, `sortOrder`); `DownloadResource` model (`id`, `slug`, `title`, `description`, `thumbnailUrl`, `fileUrl`, `fileType`, `fileSizeBytes`, `categoryId`, `requiresAuth`, `status`, `downloadCount`, `createdAt`, `updatedAt`). Later tasks' repositories/services query these directly by name (`prisma.downloadResource`, `prisma.downloadCategory`).

- [ ] **Step 1: Install the three new dependencies**

```bash
npm install @react-pdf/renderer@^4.9.0 @fontsource/inter@^5.3.0 @fontsource/cormorant-garamond@^5.3.0
```

Expected: `package.json`'s `dependencies` gains all three (not `devDependencies` — both are needed at request time in production, not just for tests/dev).

- [ ] **Step 2: Add the two models and their enum to `prisma/schema.prisma`**

Append at the end of the file (after `model BlogComment`'s closing brace), matching this file's existing `// --- <Section> (STORY-XXX) ---` section-comment convention:

```prisma

// --- Downloads & Resources (STORY-023) ---

enum DownloadResourceStatus {
  Draft
  Published
  Archived
}

model DownloadCategory {
  id        String             @id @default(cuid())
  name      String
  slug      String             @unique
  sortOrder Int                @default(0)
  resources DownloadResource[]
}

model DownloadResource {
  id            String                 @id @default(cuid())
  slug          String                 @unique
  title         String
  description   String?
  thumbnailUrl  String
  fileUrl       String
  fileType      String
  fileSizeBytes Int
  categoryId    String
  category      DownloadCategory       @relation(fields: [categoryId], references: [id])
  requiresAuth  Boolean                @default(false)
  status        DownloadResourceStatus @default(Draft)
  downloadCount Int                    @default(0)
  createdAt     DateTime               @default(now())
  updatedAt     DateTime               @updatedAt

  @@index([status, categoryId])
}
```

- [ ] **Step 3: Push the schema change for local iteration and confirm the generated client compiles**

```bash
npx prisma db push
npx prisma generate
npx tsc --noEmit -p tsconfig.json
```

Expected: `db push` reports the two new tables created; `tsc` has no new errors.

- [ ] **Step 4: Generate the real migration file via the offline schema-diff recipe (never `migrate dev`)**

```bash
git show HEAD:prisma/schema.prisma > /tmp/schema-before.prisma
TS=$(date +%Y%m%d%H%M%S)
mkdir -p "prisma/migrations/${TS}_add_download_resources"
npx prisma migrate diff --from-schema /tmp/schema-before.prisma --to-schema prisma/schema.prisma --script > "prisma/migrations/${TS}_add_download_resources/migration.sql"
rm /tmp/schema-before.prisma
```

Expected `migration.sql` content: `CREATE TYPE "DownloadResourceStatus" ...`, `CREATE TABLE "DownloadCategory" ...`, `CREATE TABLE "DownloadResource" ...`, the unique index on both `slug` columns, the `(status, categoryId)` index, and the `ALTER TABLE "DownloadResource" ADD CONSTRAINT ... FOREIGN KEY` statement — nothing else.

- [ ] **Step 5: Apply the migration to a fresh, isolated local server (never `migrate dev`)**

Stop any running `prisma dev` process:

```bash
netstat -ano | grep 51214 | grep LISTEN
# note the PID in the last column, then:
taskkill //F //PID <pid>
```

Wait ~20s, then start a fresh server on the ports this worktree's `.env` expects:

```bash
npx prisma dev --detach --db-port 51214 --shadow-db-port 51215
```

Apply in three steps against the empty database:

```bash
npx prisma db execute --file prisma/create_migrations_table.sql
npx prisma db execute --file "prisma/migrations/<the folder from Step 4>/migration.sql"
npx prisma migrate resolve --applied "<the folder name from Step 4>"
```

- [ ] **Step 6: Verify and re-seed**

```bash
npx prisma migrate status
```
Expected: `Database schema is up to date!` with the new migration listed.

```bash
npx prisma db push
```
Expected: `The database is already in sync with the Prisma schema.`

```bash
npx tsx --env-file=.env prisma/seed.ts
```
Expected: the same `Seed complete: {...}` output the seed script normally produces (this re-seeds the fresh database with everything through STORY-022; Task 10 below adds this story's own seed data on top).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json prisma/schema.prisma prisma/migrations
git commit -m "feat: add DownloadResource/DownloadCategory models and PDF dependencies"
```

---

## Task 2: Shared types, Zod validation schemas, and the file-size formatter

**Files:**
- Create: `src/types/download.ts`
- Create: `src/validation/download.schema.ts`
- Create: `src/lib/format-file-size.ts`
- Test: `tests/unit/format-file-size.test.ts`

**Interfaces:**
- Consumes: nothing (leaf files).
- Produces: `DownloadCategorySummary`, `DownloadResourceCard`, `DownloadListResult`, `DownloadListQuery` (from `types/download.ts`); `downloadListQuerySchema` (from `validation/download.schema.ts`); `formatFileSize(bytes: number): string` (from `lib/format-file-size.ts`). Tasks 3–9 import from these three files.

- [ ] **Step 1: Write `src/types/download.ts`**

```typescript
/**
 * Download library types shared by server and client code (STORY-023).
 * Keep this file free of server-only imports (Prisma, services): client
 * components import from it directly.
 */

export interface DownloadCategorySummary {
  id: string;
  name: string;
  slug: string;
}

/** A Published resource as returned by the listing API and rendered on a DownloadCard. */
export interface DownloadResourceCard {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnailUrl: string;
  fileType: string;
  fileSizeBytes: number;
  requiresAuth: boolean;
  category: DownloadCategorySummary;
}

export interface DownloadListResult {
  items: DownloadResourceCard[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DownloadListQuery {
  category?: string;
  page: number;
  pageSize: number;
}
```

- [ ] **Step 2: Write `src/validation/download.schema.ts`**

```typescript
import { z } from "zod";

export const downloadListQuerySchema = z.object({
  category: z.string().trim().min(1).optional().catch(undefined),
  page: z.coerce.number().int().positive().catch(1),
  pageSize: z.coerce.number().int().positive().max(48).catch(24),
});

export type DownloadListQuery = z.infer<typeof downloadListQuerySchema>;
```

- [ ] **Step 3: Write `src/lib/format-file-size.ts`**

```typescript
/**
 * Formats a byte count as a short human string for the download listing
 * ("1.2 MB"), matching the AC's "PDF · 1.2 MB" display requirement. Only
 * B/KB/MB are needed — nothing this library serves is ever gigabyte-scale.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

- [ ] **Step 4: Write the test**

```typescript
// tests/unit/format-file-size.test.ts
import { describe, expect, it } from "vitest";

import { formatFileSize } from "@/lib/format-file-size";

describe("formatFileSize", () => {
  it("formats bytes under 1KB", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });

  it("formats kilobytes", () => {
    expect(formatFileSize(2048)).toBe("2 KB");
  });

  it("formats megabytes with one decimal", () => {
    expect(formatFileSize(1_258_291)).toBe("1.2 MB");
  });

  it("formats exactly 1MB", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
  });
});
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run format-file-size`
Expected: PASS (4 tests). (No `prisma dev` needed — this file has no DB dependency.)

- [ ] **Step 6: Commit**

```bash
git add src/types/download.ts src/validation/download.schema.ts src/lib/format-file-size.ts tests/unit/format-file-size.test.ts
git commit -m "feat: add download types, validation schema, and file-size formatter"
```

---

## Task 3: `download.errors.ts` and `download.repository.ts`

**Files:**
- Create: `src/services/download.errors.ts`
- Create: `src/repositories/download.repository.ts`
- Test: `tests/unit/download-repository.test.ts`

**Interfaces:**
- Consumes: `Prisma`/`DownloadResourceStatus` from `@/generated/prisma/client` (Task 1).
- Produces: error classes `DownloadServiceError`, `DownloadResourceNotFoundError`, `DownloadAuthRequiredError` (each with a `.code`); repository functions `findPublishedResourceBySlug`, `listCategories`, `listPublishedResources`, `incrementDownloadCount`, and type `DownloadResourceWithCategory`. Task 4's service imports all of these.

- [ ] **Step 1: Write `src/services/download.errors.ts`**

```typescript
/**
 * Typed errors thrown by download.service.ts. Route handlers map `code` to
 * an HTTP status in one place (src/lib/api/download-responses.ts) instead
 * of matching on message strings.
 */
export type DownloadErrorCode = "not_found" | "unauthorized";

export class DownloadServiceError extends Error {
  readonly code: DownloadErrorCode;

  constructor(code: DownloadErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = new.target.name;
  }
}

export class DownloadResourceNotFoundError extends DownloadServiceError {
  constructor() {
    super("not_found", "Resource not found");
  }
}

export class DownloadAuthRequiredError extends DownloadServiceError {
  constructor() {
    super("unauthorized", "Sign in to download this resource");
  }
}
```

- [ ] **Step 2: Write `src/repositories/download.repository.ts`**

```typescript
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

const withCategory = { category: true } satisfies Prisma.DownloadResourceInclude;

export type DownloadResourceWithCategory = Prisma.DownloadResourceGetPayload<{ include: typeof withCategory }>;

export function findPublishedResourceBySlug(slug: string): Promise<DownloadResourceWithCategory | null> {
  return prisma.downloadResource.findFirst({
    where: { slug, status: "Published" },
    include: withCategory,
  });
}

export function listCategories() {
  return prisma.downloadCategory.findMany({ orderBy: { sortOrder: "asc" } });
}

export interface PublishedResourceQuery {
  categorySlug?: string;
  skip: number;
  take: number;
}

export async function listPublishedResources(
  query: PublishedResourceQuery,
): Promise<{ items: DownloadResourceWithCategory[]; total: number }> {
  const where: Prisma.DownloadResourceWhereInput = {
    status: "Published",
    ...(query.categorySlug ? { category: { slug: query.categorySlug } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.downloadResource.findMany({
      where,
      include: withCategory,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: query.skip,
      take: query.take,
    }),
    prisma.downloadResource.count({ where }),
  ]);
  return { items, total };
}

/**
 * Raw UPDATE rather than `prisma.downloadResource.update`, mirroring
 * recipe.repository.ts's incrementRecipeViewCount exactly: so `@updatedAt`
 * isn't touched by a download (a download is not a content edit).
 */
export async function incrementDownloadCount(resourceId: string): Promise<void> {
  await prisma.$executeRaw`UPDATE "DownloadResource" SET "downloadCount" = "downloadCount" + 1 WHERE "id" = ${resourceId}`;
}
```

- [ ] **Step 3: Write the repository tests**

```typescript
// tests/unit/download-repository.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  findPublishedResourceBySlug,
  incrementDownloadCount,
  listCategories,
  listPublishedResources,
} from "@/repositories/download.repository";

let sequence = 0;

async function makeCategory(sortOrder = 0) {
  sequence += 1;
  return prisma.downloadCategory.create({
    data: { name: `Category ${sequence}`, slug: `dl-category-${sequence}`, sortOrder },
  });
}

async function makeResource(categoryId: string, overrides: Partial<Parameters<typeof prisma.downloadResource.create>[0]["data"]> = {}) {
  sequence += 1;
  return prisma.downloadResource.create({
    data: {
      slug: `dl-resource-${sequence}`,
      title: `Resource ${sequence}`,
      thumbnailUrl: "/images/products/export/curry-powder.webp",
      fileUrl: "/downloads/dl-resource.pdf",
      fileType: "PDF",
      fileSizeBytes: 100_000,
      categoryId,
      status: "Published",
      ...overrides,
    },
  });
}

afterEach(async () => {
  await prisma.downloadResource.deleteMany();
  await prisma.downloadCategory.deleteMany();
});

describe("findPublishedResourceBySlug", () => {
  it("finds a Published resource with its category", async () => {
    const category = await makeCategory();
    const resource = await makeResource(category.id);

    const found = await findPublishedResourceBySlug(resource.slug);
    expect(found?.id).toBe(resource.id);
    expect(found?.category.id).toBe(category.id);
  });

  it("returns null for a Draft resource", async () => {
    const category = await makeCategory();
    const resource = await makeResource(category.id, { status: "Draft" });

    expect(await findPublishedResourceBySlug(resource.slug)).toBeNull();
  });

  it("returns null for a nonexistent slug", async () => {
    expect(await findPublishedResourceBySlug("does-not-exist")).toBeNull();
  });
});

describe("listCategories", () => {
  it("returns categories ordered by sortOrder", async () => {
    await makeCategory(2);
    await makeCategory(0);
    await makeCategory(1);

    const categories = await listCategories();
    expect(categories.map((c) => c.sortOrder)).toEqual([0, 1, 2]);
  });
});

describe("listPublishedResources", () => {
  it("only returns Published resources, filterable by category slug", async () => {
    const categoryA = await makeCategory();
    const categoryB = await makeCategory();
    await makeResource(categoryA.id);
    await makeResource(categoryA.id, { status: "Draft" });
    const inCategoryB = await makeResource(categoryB.id);

    const all = await listPublishedResources({ skip: 0, take: 10 });
    expect(all.total).toBe(2); // the Draft one excluded

    const filtered = await listPublishedResources({ categorySlug: categoryB.slug, skip: 0, take: 10 });
    expect(filtered.total).toBe(1);
    expect(filtered.items[0]?.id).toBe(inCategoryB.id);
  });

  it("paginates", async () => {
    const category = await makeCategory();
    await makeResource(category.id);
    await makeResource(category.id);
    await makeResource(category.id);

    const page = await listPublishedResources({ skip: 1, take: 1 });
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(3);
  });
});

describe("incrementDownloadCount", () => {
  it("increments downloadCount without touching updatedAt", async () => {
    const category = await makeCategory();
    const resource = await makeResource(category.id);

    await incrementDownloadCount(resource.id);

    const refreshed = await prisma.downloadResource.findUniqueOrThrow({ where: { id: resource.id } });
    expect(refreshed.downloadCount).toBe(1);
    expect(refreshed.updatedAt.getTime()).toBe(resource.updatedAt.getTime());
  });

  it("two sequential increments both land (no lost update)", async () => {
    const category = await makeCategory();
    const resource = await makeResource(category.id);

    await incrementDownloadCount(resource.id);
    await incrementDownloadCount(resource.id);

    const refreshed = await prisma.downloadResource.findUniqueOrThrow({ where: { id: resource.id } });
    expect(refreshed.downloadCount).toBe(2);
  });
});
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run download-repository`
Expected: PASS (all tests). Ensure `npx prisma dev` is running first.

- [ ] **Step 5: Commit**

```bash
git add src/services/download.errors.ts src/repositories/download.repository.ts tests/unit/download-repository.test.ts
git commit -m "feat: add download repository and typed errors"
```

---

## Task 4: `download.service.ts`

**Files:**
- Create: `src/services/download.service.ts`
- Test: `tests/unit/download-service.test.ts`

**Interfaces:**
- Consumes: everything Task 3 produces; `DownloadListQuery` from Task 2.
- Produces: `listCategories(): Promise<DownloadCategorySummary[]>`, `listResources(query: DownloadListQuery): Promise<DownloadListResult>`, `resolveFileAccess(slug: string, isAuthenticated: boolean): Promise<DownloadResourceWithCategory>` (throws `DownloadResourceNotFoundError` or `DownloadAuthRequiredError`), `recordDownload(resourceId: string): Promise<void>`. Task 5's routes call all of these.

- [ ] **Step 1: Write `src/services/download.service.ts`**

```typescript
import * as downloadRepository from "@/repositories/download.repository";
import { DownloadAuthRequiredError, DownloadResourceNotFoundError } from "@/services/download.errors";
import type { DownloadCategorySummary, DownloadListQuery, DownloadListResult, DownloadResourceCard } from "@/types/download";

function toCard(row: downloadRepository.DownloadResourceWithCategory): DownloadResourceCard {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    thumbnailUrl: row.thumbnailUrl,
    fileType: row.fileType,
    fileSizeBytes: row.fileSizeBytes,
    requiresAuth: row.requiresAuth,
    category: { id: row.category.id, name: row.category.name, slug: row.category.slug },
  };
}

export async function listCategories(): Promise<DownloadCategorySummary[]> {
  const rows = await downloadRepository.listCategories();
  return rows.map((row) => ({ id: row.id, name: row.name, slug: row.slug }));
}

export async function listResources(query: DownloadListQuery): Promise<DownloadListResult> {
  const { items, total } = await downloadRepository.listPublishedResources({
    categorySlug: query.category,
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  });
  return { items: items.map(toCard), total, page: query.page, pageSize: query.pageSize };
}

/**
 * Called by the file-serving route before it ever touches the filesystem
 * (Task 5). Throws DownloadResourceNotFoundError for a missing OR
 * unpublished slug (the caller can't distinguish "never existed" from
 * "exists but Draft/Archived" from the response — same information-hiding
 * choice recipe-review.service.ts's requirePublishedRecipe already makes)
 * and DownloadAuthRequiredError when the resource requires a session the
 * caller doesn't have.
 */
export async function resolveFileAccess(
  slug: string,
  isAuthenticated: boolean,
): Promise<downloadRepository.DownloadResourceWithCategory> {
  const resource = await downloadRepository.findPublishedResourceBySlug(slug);
  if (!resource) throw new DownloadResourceNotFoundError();
  if (resource.requiresAuth && !isAuthenticated) throw new DownloadAuthRequiredError();
  return resource;
}

export function recordDownload(resourceId: string): Promise<void> {
  return downloadRepository.incrementDownloadCount(resourceId);
}
```

- [ ] **Step 2: Write the service tests**

```typescript
// tests/unit/download-service.test.ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { DownloadAuthRequiredError, DownloadResourceNotFoundError } from "@/services/download.errors";
import { listCategories, listResources, recordDownload, resolveFileAccess } from "@/services/download.service";

let sequence = 0;

async function makeCategory() {
  sequence += 1;
  return prisma.downloadCategory.create({ data: { name: `Category ${sequence}`, slug: `dl-svc-category-${sequence}` } });
}

async function makeResource(categoryId: string, overrides: Record<string, unknown> = {}) {
  sequence += 1;
  return prisma.downloadResource.create({
    data: {
      slug: `dl-svc-resource-${sequence}`,
      title: `Resource ${sequence}`,
      thumbnailUrl: "/images/products/export/curry-powder.webp",
      fileUrl: "/downloads/dl-svc-resource.pdf",
      fileType: "PDF",
      fileSizeBytes: 50_000,
      categoryId,
      status: "Published",
      ...overrides,
    },
  });
}

afterEach(async () => {
  await prisma.downloadResource.deleteMany();
  await prisma.downloadCategory.deleteMany();
});

describe("listCategories / listResources", () => {
  it("lists categories and Published resources as cards", async () => {
    const category = await makeCategory();
    await makeResource(category.id, { title: "Nutrition Guide" });

    const categories = await listCategories();
    expect(categories.map((c) => c.id)).toContain(category.id);

    const page = await listResources({ page: 1, pageSize: 24 });
    expect(page.total).toBe(1);
    expect(page.items[0]?.title).toBe("Nutrition Guide");
    expect(page.items[0]?.category.id).toBe(category.id);
  });
});

describe("resolveFileAccess", () => {
  it("resolves a public Published resource for an unauthenticated caller", async () => {
    const category = await makeCategory();
    const resource = await makeResource(category.id, { requiresAuth: false });

    const resolved = await resolveFileAccess(resource.slug, false);
    expect(resolved.id).toBe(resource.id);
  });

  it("throws DownloadResourceNotFoundError for a Draft resource", async () => {
    const category = await makeCategory();
    const resource = await makeResource(category.id, { status: "Draft" });

    await expect(resolveFileAccess(resource.slug, true)).rejects.toThrow(DownloadResourceNotFoundError);
  });

  it("throws DownloadResourceNotFoundError for a nonexistent slug", async () => {
    await expect(resolveFileAccess("does-not-exist", true)).rejects.toThrow(DownloadResourceNotFoundError);
  });

  it("throws DownloadAuthRequiredError for a requiresAuth resource with no session", async () => {
    const category = await makeCategory();
    const resource = await makeResource(category.id, { requiresAuth: true });

    await expect(resolveFileAccess(resource.slug, false)).rejects.toThrow(DownloadAuthRequiredError);
  });

  it("resolves a requiresAuth resource for an authenticated caller", async () => {
    const category = await makeCategory();
    const resource = await makeResource(category.id, { requiresAuth: true });

    const resolved = await resolveFileAccess(resource.slug, true);
    expect(resolved.id).toBe(resource.id);
  });
});

describe("recordDownload", () => {
  it("increments the resource's downloadCount", async () => {
    const category = await makeCategory();
    const resource = await makeResource(category.id);

    await recordDownload(resource.id);

    const refreshed = await prisma.downloadResource.findUniqueOrThrow({ where: { id: resource.id } });
    expect(refreshed.downloadCount).toBe(1);
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run download-service`
Expected: PASS (all tests).

- [ ] **Step 4: Commit**

```bash
git add src/services/download.service.ts tests/unit/download-service.test.ts
git commit -m "feat: add download service"
```

---

## Task 5: `download-responses.ts` and the download API routes

**Files:**
- Create: `src/lib/api/download-responses.ts`
- Create: `src/app/api/downloads/route.ts`
- Create: `src/app/api/downloads/[slug]/file/route.ts`
- Test: `tests/unit/download-routes.test.ts`

**Interfaces:**
- Consumes: `serverErrorResponse` from `@/lib/api/responses` (existing, shared); everything Task 4 produces; `downloadListQuerySchema` from Task 2.
- Produces: `GET /api/downloads`, `GET /api/downloads/[slug]/file`. Task 8's frontend links to both by URL string, not a typed client wrapper (the list route's response is consumed server-side by the listing page; the file route is a plain `<a href>`, per spec decision #9 — no client fetch wrapper is needed for either).

- [ ] **Step 1: Write `src/lib/api/download-responses.ts`**

```typescript
import { NextResponse } from "next/server";

import { DownloadErrorCode, DownloadServiceError } from "@/services/download.errors";

const statusByCode: Record<DownloadErrorCode, number> = {
  not_found: 404,
  unauthorized: 401,
};

export function downloadErrorResponse(error: unknown) {
  if (error instanceof DownloadServiceError) {
    return NextResponse.json({ error: error.message }, { status: statusByCode[error.code] });
  }
  throw error;
}
```

- [ ] **Step 2: Write `src/app/api/downloads/route.ts`**

```typescript
import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { listResources } from "@/services/download.service";
import { downloadListQuerySchema } from "@/validation/download.schema";

export async function GET(request: Request) {
  const query = downloadListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  try {
    return NextResponse.json(await listResources(query));
  } catch (error) {
    return serverErrorResponse(error, "GET /api/downloads");
  }
}
```

- [ ] **Step 3: Write `src/app/api/downloads/[slug]/file/route.ts`**

```typescript
import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { downloadErrorResponse } from "@/lib/api/download-responses";
import { serverErrorResponse } from "@/lib/api/responses";
import { recordDownload, resolveFileAccess } from "@/services/download.service";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const session = await auth();
    const resource = await resolveFileAccess(slug, Boolean(session?.user?.id));

    let bytes: Buffer;
    try {
      bytes = await readFile(path.join(process.cwd(), "public", resource.fileUrl));
    } catch {
      // Metadata/file drift (a DownloadResource row survives its file being
      // moved/deleted) — a clean 404, never an unhandled fs exception
      // surfacing as a raw 500 (the AC's "fail gracefully" requirement).
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    await recordDownload(resource.id);

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": resource.fileType === "PDF" ? "application/pdf" : "application/octet-stream",
        "Content-Disposition": `attachment; filename="${resource.slug}.pdf"`,
      },
    });
  } catch (error) {
    return downloadErrorResponse(error) ?? serverErrorResponse(error, "GET /api/downloads/[slug]/file");
  }
}
```

- [ ] **Step 4: Write the route tests**

```typescript
// tests/unit/download-routes.test.ts
// @vitest-environment node
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { GET as getDownloads } from "@/app/api/downloads/route";
import { GET as getDownloadFile } from "@/app/api/downloads/[slug]/file/route";
import { prisma } from "@/lib/db";

const mockAuth = vi.mocked(auth);

let sequence = 0;
const TEST_FILE_DIR = path.join(process.cwd(), "public", "downloads");

async function makeCategory() {
  sequence += 1;
  return prisma.downloadCategory.create({ data: { name: `Category ${sequence}`, slug: `dl-route-category-${sequence}` } });
}

async function makeResourceWithRealFile(categoryId: string, overrides: Record<string, unknown> = {}) {
  sequence += 1;
  const fileName = `dl-route-test-${sequence}.pdf`;
  await mkdir(TEST_FILE_DIR, { recursive: true });
  await writeFile(path.join(TEST_FILE_DIR, fileName), "%PDF-1.4 test file content");
  return prisma.downloadResource.create({
    data: {
      slug: `dl-route-resource-${sequence}`,
      title: `Resource ${sequence}`,
      thumbnailUrl: "/images/products/export/curry-powder.webp",
      fileUrl: `/downloads/${fileName}`,
      fileType: "PDF",
      fileSizeBytes: 27,
      categoryId,
      status: "Published",
      ...overrides,
    },
  });
}

function sessionFor(userId: string) {
  return { user: { id: userId }, expires: new Date(Date.now() + 60_000).toISOString() };
}

beforeEach(() => {
  mockAuth.mockReset();
  mockAuth.mockResolvedValue(null);
});

afterEach(async () => {
  await prisma.downloadResource.deleteMany();
  await prisma.downloadCategory.deleteMany();
  await rm(TEST_FILE_DIR, { recursive: true, force: true });
});

describe("GET /api/downloads", () => {
  it("returns Published resources", async () => {
    const category = await makeCategory();
    await makeResourceWithRealFile(category.id);

    const response = await getDownloads(new Request("http://localhost/api/downloads"));
    const body = (await response.json()) as { total: number };
    expect(response.status).toBe(200);
    expect(body.total).toBe(1);
  });

  it("filters by category", async () => {
    const categoryA = await makeCategory();
    const categoryB = await makeCategory();
    await makeResourceWithRealFile(categoryA.id);
    await makeResourceWithRealFile(categoryB.id);

    const response = await getDownloads(new Request(`http://localhost/api/downloads?category=${categoryB.slug}`));
    const body = (await response.json()) as { total: number };
    expect(body.total).toBe(1);
  });
});

describe("GET /api/downloads/[slug]/file", () => {
  it("serves the file and increments downloadCount", async () => {
    const category = await makeCategory();
    const resource = await makeResourceWithRealFile(category.id);

    const response = await getDownloadFile(new Request(`http://localhost/api/downloads/${resource.slug}/file`), {
      params: Promise.resolve({ slug: resource.slug }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain("attachment");
    const refreshed = await prisma.downloadResource.findUniqueOrThrow({ where: { id: resource.id } });
    expect(refreshed.downloadCount).toBe(1);
  });

  it("returns 404 for a Draft resource (not shown, not servable)", async () => {
    const category = await makeCategory();
    const resource = await makeResourceWithRealFile(category.id, { status: "Draft" });

    const response = await getDownloadFile(new Request(`http://localhost/api/downloads/${resource.slug}/file`), {
      params: Promise.resolve({ slug: resource.slug }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 404 for a nonexistent slug", async () => {
    const response = await getDownloadFile(new Request("http://localhost/api/downloads/does-not-exist/file"), {
      params: Promise.resolve({ slug: "does-not-exist" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 401 for a requiresAuth resource with no session, before recordDownload runs", async () => {
    const category = await makeCategory();
    const resource = await makeResourceWithRealFile(category.id, { requiresAuth: true });

    const response = await getDownloadFile(new Request(`http://localhost/api/downloads/${resource.slug}/file`), {
      params: Promise.resolve({ slug: resource.slug }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get("Content-Disposition")).toBeNull();
    const refreshed = await prisma.downloadResource.findUniqueOrThrow({ where: { id: resource.id } });
    expect(refreshed.downloadCount).toBe(0);
  });

  it("serves a requiresAuth resource for an authenticated caller", async () => {
    const category = await makeCategory();
    const resource = await makeResourceWithRealFile(category.id, { requiresAuth: true });
    mockAuth.mockResolvedValue(sessionFor("user-1"));

    const response = await getDownloadFile(new Request(`http://localhost/api/downloads/${resource.slug}/file`), {
      params: Promise.resolve({ slug: resource.slug }),
    });

    expect(response.status).toBe(200);
  });

  it("returns 404, not a 500, when the DB row's file is missing on disk", async () => {
    const category = await makeCategory();
    const resource = await prisma.downloadResource.create({
      data: {
        slug: "dl-route-missing-file",
        title: "Missing file resource",
        thumbnailUrl: "/images/products/export/curry-powder.webp",
        fileUrl: "/downloads/does-not-exist-on-disk.pdf",
        fileType: "PDF",
        fileSizeBytes: 100,
        categoryId: category.id,
        status: "Published",
      },
    });

    const response = await getDownloadFile(new Request(`http://localhost/api/downloads/${resource.slug}/file`), {
      params: Promise.resolve({ slug: resource.slug }),
    });

    expect(response.status).toBe(404);
    const refreshed = await prisma.downloadResource.findUniqueOrThrow({ where: { id: resource.id } });
    expect(refreshed.downloadCount).toBe(0); // never reached recordDownload
  });
});
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run download-routes`
Expected: PASS (all tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/api/download-responses.ts src/app/api/downloads tests/unit/download-routes.test.ts
git commit -m "feat: add download API routes"
```

---

## Task 6: `recipe-pdf.service.ts` and its API route

**Files:**
- Create: `src/services/recipe-pdf.service.ts`
- Create: `src/app/api/recipes/[slug]/pdf/route.ts`
- Test: `tests/unit/recipe-pdf-service.test.ts`

**Interfaces:**
- Consumes: `getRecipeBySlug` from `@/services/recipe.service` (existing, STORY-018).
- Produces: `renderRecipePdf(recipe: RecipeDetail): Promise<Buffer>`. Task 11's e2e test hits the route directly; no other task imports this service.

**Scope note (not in the original story task list, a deliberate narrowing):** v1 renders text only — title, meta line, ingredients, method steps, brand colors/fonts — no embedded hero photo. The AC's wording ("ingredients + method, respecting the brand's visual identity") doesn't require the photo, and image embedding in `@react-pdf/renderer` adds a second filesystem-read path and format-compatibility surface for no AC-required behavior. If a photo is wanted later, `recipe.heroImage` is already available on the `RecipeDetail` this service receives — this is a one-`<Image>`-element addition when needed, not a re-architecture.

- [ ] **Step 1: Write `src/services/recipe-pdf.service.ts`**

```typescript
import path from "node:path";

import { Document, Font, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { RecipeDetail } from "@/types/recipe";

// @react-pdf/renderer embeds fonts via fontkit, which needs real font
// files — the web app's next/font/google CSS mechanism doesn't apply here.
// @fontsource ships the same Google Fonts as .woff files; registered once
// at module load (fine to repeat per Next.js dev-server module reload —
// Font.register is idempotent per family+weight).
const FONT_DIR = path.join(process.cwd(), "node_modules");

Font.register({
  family: "Cormorant Garamond",
  fonts: [
    { src: path.join(FONT_DIR, "@fontsource/cormorant-garamond/files/cormorant-garamond-latin-700-normal.woff"), fontWeight: 700 },
  ],
});

Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(FONT_DIR, "@fontsource/inter/files/inter-latin-400-normal.woff"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "@fontsource/inter/files/inter-latin-600-normal.woff"), fontWeight: 600 },
    { src: path.join(FONT_DIR, "@fontsource/inter/files/inter-latin-700-normal.woff"), fontWeight: 700 },
  ],
});

// Hex values from docs/blueprint.md Section 2's brand color table.
const COLORS = {
  ivory: "#FAF7F2",
  charcoal: "#2F2B2A",
  gold: "#CDAF52",
  chilliRed: "#B22222",
  stoneGrey: "#8A817C",
  softBorder: "#E5DED5",
};

const styles = StyleSheet.create({
  page: { backgroundColor: COLORS.ivory, padding: 40, fontFamily: "Inter", fontSize: 10, color: COLORS.charcoal },
  title: { fontFamily: "Cormorant Garamond", fontSize: 28, marginBottom: 4 },
  categoryLine: { fontSize: 10, color: COLORS.gold, fontWeight: 700, marginBottom: 12 },
  metaRow: { flexDirection: "row", gap: 16, marginBottom: 16, paddingBottom: 12, borderBottom: `1pt solid ${COLORS.softBorder}` },
  metaLabel: { fontSize: 8, color: COLORS.stoneGrey },
  metaValue: { fontSize: 11, fontWeight: 600 },
  sectionHeading: { fontFamily: "Cormorant Garamond", fontSize: 16, fontWeight: 700, color: COLORS.chilliRed, marginTop: 16, marginBottom: 8 },
  ingredientRow: { fontSize: 10, marginBottom: 4 },
  stepRow: { fontSize: 10, marginBottom: 8, flexDirection: "row", gap: 8 },
  stepNumber: { fontWeight: 700, color: COLORS.chilliRed, width: 20 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: COLORS.stoneGrey, textAlign: "center" },
});

function RecipePdfDocument({ recipe }: { recipe: RecipeDetail }) {
  return (
    <Document title={`${recipe.title} — Oristor`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{recipe.title}</Text>
        <Text style={styles.categoryLine}>{recipe.categoryName}{recipe.cuisine ? ` · ${recipe.cuisine}` : ""}</Text>

        <View style={styles.metaRow}>
          <View>
            <Text style={styles.metaLabel}>Prep</Text>
            <Text style={styles.metaValue}>{recipe.prepTimeMinutes} min</Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>Cook</Text>
            <Text style={styles.metaValue}>{recipe.cookTimeMinutes} min</Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>Total</Text>
            <Text style={styles.metaValue}>{recipe.totalTimeMinutes} min</Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>Serves</Text>
            <Text style={styles.metaValue}>{recipe.servings}</Text>
          </View>
          <View>
            <Text style={styles.metaLabel}>Difficulty</Text>
            <Text style={styles.metaValue}>{recipe.difficulty}</Text>
          </View>
        </View>

        <Text style={styles.sectionHeading}>Ingredients</Text>
        {recipe.ingredients.map((ingredient) => (
          <Text key={ingredient.id} style={styles.ingredientRow}>
            • {ingredient.displayText}
          </Text>
        ))}

        <Text style={styles.sectionHeading}>Method</Text>
        {recipe.steps.map((step) => (
          <View key={step.stepNumber} style={styles.stepRow}>
            <Text style={styles.stepNumber}>{step.stepNumber}.</Text>
            <Text>{step.instruction}</Text>
          </View>
        ))}

        <Text style={styles.footer} fixed>
          ORISTOR — Feel the Difference · oristor.com
        </Text>
      </Page>
    </Document>
  );
}

export function renderRecipePdf(recipe: RecipeDetail): Promise<Buffer> {
  return renderToBuffer(<RecipePdfDocument recipe={recipe} />);
}
```

- [ ] **Step 2: Write `src/app/api/recipes/[slug]/pdf/route.ts`**

```typescript
import { NextResponse } from "next/server";

import { serverErrorResponse } from "@/lib/api/responses";
import { getRecipeBySlug } from "@/services/recipe.service";
import { renderRecipePdf } from "@/services/recipe-pdf.service";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const recipe = await getRecipeBySlug(slug);
    if (!recipe) return NextResponse.json({ error: "Recipe not found" }, { status: 404 });

    const buffer = await renderRecipePdf(recipe);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${recipe.slug}.pdf"`,
      },
    });
  } catch (error) {
    return serverErrorResponse(error, "GET /api/recipes/[slug]/pdf");
  }
}
```

- [ ] **Step 3: Write the service test**

```typescript
// tests/unit/recipe-pdf-service.test.ts
// @vitest-environment node
import { describe, expect, it } from "vitest";

import { renderRecipePdf } from "@/services/recipe-pdf.service";
import type { RecipeDetail } from "@/types/recipe";

function makeMinimalRecipe(overrides: Partial<RecipeDetail> = {}): RecipeDetail {
  return {
    id: "recipe-1",
    slug: "test-recipe",
    href: "/recipes/test-recipe",
    title: "Test Recipe",
    shortDescription: "A test recipe.",
    heroImage: "/images/products/export/curry-powder.webp",
    heroImageAlt: "Test",
    galleryImageUrls: [],
    categoryName: "Curries",
    categorySlug: "curries",
    cuisine: null,
    difficulty: "Easy",
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: 30,
    servings: 4,
    avgRating: null,
    ratingCount: 0,
    dietaryTags: [],
    chefNotes: null,
    nutrition: { calories: null, protein: null, carbs: null, fat: null, fiber: null, sodium: null },
    ingredients: [{ id: "ing-1", quantity: 1, unit: "tsp", displayText: "1 tsp Salt, to taste", product: null }],
    steps: [{ stepNumber: 1, instruction: "Combine everything.", imageUrl: null }],
    metaTitle: null,
    metaDescription: null,
    publishedAt: null,
    relatedRecipes: [],
    video: null,
    ...overrides,
  };
}

describe("renderRecipePdf", () => {
  it("renders a non-empty PDF buffer for a fully-populated recipe", async () => {
    const buffer = await renderRecipePdf(makeMinimalRecipe());
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("renders successfully for a recipe with every optional field null/empty", async () => {
    const sparse = makeMinimalRecipe({
      cuisine: null,
      chefNotes: null,
      video: null,
      dietaryTags: [],
      avgRating: null,
      ratingCount: 0,
    });
    const buffer = await renderRecipePdf(sparse);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("renders successfully with multiple ingredients and steps", async () => {
    const recipe = makeMinimalRecipe({
      ingredients: [
        { id: "ing-1", quantity: 1, unit: "kg", displayText: "1 kg Chicken", product: null },
        { id: "ing-2", quantity: null, unit: null, displayText: "Salt, to taste", product: null },
      ],
      steps: [
        { stepNumber: 1, instruction: "Marinate the chicken.", imageUrl: null },
        { stepNumber: 2, instruction: "Cook until done.", imageUrl: null },
      ],
    });
    const buffer = await renderRecipePdf(recipe);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run recipe-pdf-service`
Expected: PASS (3 tests). (No `prisma dev` needed — this test never touches the DB.)

If a test fails with a font-loading error, verify the `.woff` files exist at the exact paths registered in Step 1:

```bash
ls node_modules/@fontsource/inter/files/inter-latin-400-normal.woff
ls node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-700-normal.woff
```

- [ ] **Step 5: Commit**

```bash
git add src/services/recipe-pdf.service.ts src/app/api/recipes/[slug]/pdf tests/unit/recipe-pdf-service.test.ts
git commit -m "feat: add recipe PDF generation service and route"
```

---

## Task 7: `DownloadCard`, `DownloadCategoryFilter`, and the `/downloads` listing page

**Files:**
- Create: `src/components/storefront/downloads/download-card.tsx`
- Create: `src/components/storefront/downloads/download-category-filter.tsx`
- Create: `src/lib/download-chip-href.ts`
- Create: `src/app/(storefront)/downloads/page.tsx`
- Test: `tests/unit/download-card.test.tsx`
- Test: `tests/unit/download-chip-href.test.ts`

**Interfaces:**
- Consumes: `DownloadResourceCard`, `DownloadCategorySummary` from `@/types/download` (Task 2); `formatFileSize` from `@/lib/format-file-size` (Task 2); `listCategories`/`listResources` from `@/services/download.service` (Task 4); `downloadListQuerySchema` from `@/validation/download.schema` (Task 2).
- Produces: the `/downloads` page. No later task depends on these components directly.

- [ ] **Step 1: Write `src/lib/download-chip-href.ts`**

```typescript
/**
 * Builds a `/downloads?...` href for a category filter chip, matching
 * buildBlogChipHref's shape (STORY-021) adapted to a single filter
 * dimension. `category: undefined` explicitly clears the filter (the "All"
 * chip) rather than being indistinguishable from "leave it alone" — same
 * `in` operator reasoning as the blog precedent.
 */
export function buildDownloadChipHref(query: { category?: string }, overrides: { category?: string }): string {
  const params = new URLSearchParams();
  const category = "category" in overrides ? overrides.category : query.category;
  if (category) params.set("category", category);
  const qs = params.toString();
  return qs ? `/downloads?${qs}` : "/downloads";
}
```

- [ ] **Step 2: Write `tests/unit/download-chip-href.test.ts`**

```typescript
import { describe, expect, it } from "vitest";

import { buildDownloadChipHref } from "@/lib/download-chip-href";

describe("buildDownloadChipHref", () => {
  it("builds a plain /downloads href with no category", () => {
    expect(buildDownloadChipHref({}, {})).toBe("/downloads");
  });

  it("builds an href with the overridden category", () => {
    expect(buildDownloadChipHref({}, { category: "nutrition-guides" })).toBe("/downloads?category=nutrition-guides");
  });

  it("preserves the current category when not overridden", () => {
    expect(buildDownloadChipHref({ category: "nutrition-guides" }, {})).toBe("/downloads?category=nutrition-guides");
  });

  it("explicitly clears the category when overridden with undefined (the 'All' chip)", () => {
    expect(buildDownloadChipHref({ category: "nutrition-guides" }, { category: undefined })).toBe("/downloads");
  });
});
```

- [ ] **Step 3: Run the chip-href test**

Run: `npx vitest run download-chip-href`
Expected: PASS (4 tests).

- [ ] **Step 4: Write `src/components/storefront/downloads/download-card.tsx`**

```tsx
import Image from "next/image";

import { formatFileSize } from "@/lib/format-file-size";
import type { DownloadResourceCard } from "@/types/download";

export function DownloadCard({ resource }: { resource: DownloadResourceCard }) {
  const sizeLabel = `${resource.fileType} · ${formatFileSize(resource.fileSizeBytes)}`;
  const accessibleLabel = `Download ${resource.title}, ${sizeLabel}`;

  return (
    <article className="overflow-hidden rounded-lg border border-input bg-cream">
      <div className="relative aspect-[4/3]">
        <Image src={resource.thumbnailUrl} alt="" fill className="object-cover" />
      </div>
      <div className="p-4">
        <p className="text-caption text-charcoal/60">{resource.category.name}</p>
        <h3 className="mt-1 text-h4 font-heading text-charcoal">{resource.title}</h3>
        {resource.description ? <p className="mt-1 text-small text-charcoal/70">{resource.description}</p> : null}
        <p className="mt-2 text-caption text-charcoal/60">{sizeLabel}</p>
        <a
          href={`/api/downloads/${resource.slug}/file`}
          download
          aria-label={accessibleLabel}
          className="mt-3 inline-flex items-center rounded-full bg-chilli px-4 py-2 text-small font-medium text-white"
        >
          Download
        </a>
      </div>
    </article>
  );
}
```

- [ ] **Step 5: Write `tests/unit/download-card.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DownloadCard } from "@/components/storefront/downloads/download-card";
import type { DownloadResourceCard } from "@/types/download";

const resource: DownloadResourceCard = {
  id: "resource-1",
  slug: "nutrition-guide",
  title: "Nutrition Guide",
  description: "A guide to reading nutrition labels.",
  thumbnailUrl: "/images/products/export/curry-powder.webp",
  fileType: "PDF",
  fileSizeBytes: 1_258_291,
  requiresAuth: false,
  category: { id: "cat-1", name: "Nutrition Guides", slug: "nutrition-guides" },
};

describe("DownloadCard", () => {
  it("renders the title, category, and formatted size", () => {
    render(<DownloadCard resource={resource} />);
    expect(screen.getByText("Nutrition Guide")).toBeInTheDocument();
    expect(screen.getByText("Nutrition Guides")).toBeInTheDocument();
    expect(screen.getByText("PDF · 1.2 MB")).toBeInTheDocument();
  });

  it("gives the download link a descriptive accessible name, not a bare 'Download'", () => {
    render(<DownloadCard resource={resource} />);
    const link = screen.getByRole("link", { name: "Download Nutrition Guide, PDF · 1.2 MB" });
    expect(link).toHaveAttribute("href", "/api/downloads/nutrition-guide/file");
    expect(link).toHaveAttribute("download");
  });
});
```

- [ ] **Step 6: Run the component test**

Run: `npx vitest run download-card`
Expected: PASS (2 tests).

- [ ] **Step 7: Write `src/components/storefront/downloads/download-category-filter.tsx`**

```tsx
import Link from "next/link";

import { buildDownloadChipHref } from "@/lib/download-chip-href";
import { cn } from "@/lib/utils";
import type { DownloadCategorySummary } from "@/types/download";

export function DownloadCategoryFilter({ categories, activeCategory }: { categories: DownloadCategorySummary[]; activeCategory?: string }) {
  return (
    <nav aria-label="Filter by category" className="mt-8 flex flex-wrap gap-2">
      <Link
        href={buildDownloadChipHref({ category: activeCategory }, { category: undefined })}
        aria-current={!activeCategory ? "page" : undefined}
        className={cn("rounded-full border px-4 py-1.5 text-small", !activeCategory ? "border-chilli bg-chilli text-white" : "border-input")}
      >
        All resources
      </Link>
      {categories.map((category) => (
        <Link
          key={category.slug}
          href={buildDownloadChipHref({ category: activeCategory }, { category: category.slug })}
          aria-current={activeCategory === category.slug ? "page" : undefined}
          className={cn(
            "rounded-full border px-4 py-1.5 text-small",
            activeCategory === category.slug ? "border-chilli bg-chilli text-white" : "border-input",
          )}
        >
          {category.name}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 8: Write `src/app/(storefront)/downloads/page.tsx`**

```tsx
import type { Metadata } from "next";

import { Section } from "@/components/storefront/layout/section";
import { DownloadCard } from "@/components/storefront/downloads/download-card";
import { DownloadCategoryFilter } from "@/components/storefront/downloads/download-category-filter";
import { listCategories, listResources } from "@/services/download.service";
import { downloadListQuerySchema } from "@/validation/download.schema";

export const metadata: Metadata = {
  title: "Downloads & Resources",
  description: "Printable recipe cards, nutrition guides, and ingredient resources from Oristor.",
  alternates: { canonical: "/downloads" },
};

interface DownloadsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function DownloadsPage({ searchParams }: DownloadsPageProps) {
  const rawParams = await searchParams;
  const query = downloadListQuerySchema.parse({
    category: typeof rawParams.category === "string" ? rawParams.category : undefined,
    page: rawParams.page,
  });
  const [result, categories] = await Promise.all([listResources(query), listCategories()]);

  return (
    <Section>
      <h1 className="text-h1 font-heading text-charcoal">Downloads & Resources</h1>

      <DownloadCategoryFilter categories={categories} activeCategory={query.category} />

      <h2 id="downloads-results-heading" className="sr-only">
        Download results
      </h2>
      <p className="mt-6 text-small text-charcoal/70">
        {result.total} resource{result.total === 1 ? "" : "s"}
      </p>

      {result.items.length === 0 ? (
        <p className="mt-4 text-body text-charcoal/70">No resources match that filter.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3" aria-labelledby="downloads-results-heading">
          {result.items.map((resource) => (
            <DownloadCard key={resource.id} resource={resource} />
          ))}
        </div>
      )}
    </Section>
  );
}
```

- [ ] **Step 9: Run `tsc` and `lint`**

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint
```

Expected: no new errors.

- [ ] **Step 10: Commit**

```bash
git add src/components/storefront/downloads src/lib/download-chip-href.ts "src/app/(storefront)/downloads" tests/unit/download-card.test.tsx tests/unit/download-chip-href.test.ts
git commit -m "feat: add the downloads listing page, category filter, and download card"
```

---

## Task 8: "Download PDF" button on the recipe detail page

**Files:**
- Modify: `src/components/storefront/recipes/recipe-print-share-bar.tsx`
- Modify: `src/components/storefront/recipes/recipe-detail-view.tsx`
- Test: `tests/unit/recipe-print-share-bar.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `RecipePrintShareBar` gains a `recipeSlug: string` prop. `RecipeDetailView` passes `recipe.slug` through.

- [ ] **Step 1: Modify `src/components/storefront/recipes/recipe-print-share-bar.tsx`**

```tsx
"use client";

import { Download, Printer } from "lucide-react";
import { ShareButtons } from "@/components/storefront/product/share-buttons";
import { Button } from "@/components/ui/button";

interface RecipePrintShareBarProps {
  url: string;
  title: string;
  recipeSlug: string;
}

export function RecipePrintShareBar({ url, title, recipeSlug }: RecipePrintShareBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 print:hidden">
      <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
        <Printer />
        Print
      </Button>
      <Button type="button" variant="outline" size="sm" asChild>
        <a href={`/api/recipes/${recipeSlug}/pdf`} download aria-label={`Download ${title} recipe card as a PDF`}>
          <Download />
          Download PDF
        </a>
      </Button>
      <ShareButtons url={url} title={title} />
    </div>
  );
}
```

- [ ] **Step 2: Modify `src/components/storefront/recipes/recipe-detail-view.tsx`**

Change the `RecipePrintShareBar` render call (the file's only usage) from:

```tsx
          <RecipePrintShareBar url={pageUrl} title={recipe.title} />
```

to:

```tsx
          <RecipePrintShareBar url={pageUrl} title={recipe.title} recipeSlug={recipe.slug} />
```

- [ ] **Step 3: Write `tests/unit/recipe-print-share-bar.test.tsx`**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RecipePrintShareBar } from "@/components/storefront/recipes/recipe-print-share-bar";

describe("RecipePrintShareBar", () => {
  it("renders a Download PDF link pointing at the recipe's PDF route", () => {
    render(<RecipePrintShareBar url="https://oristor.com/recipes/test-recipe" title="Test Recipe" recipeSlug="test-recipe" />);

    const link = screen.getByRole("link", { name: "Download Test Recipe recipe card as a PDF" });
    expect(link).toHaveAttribute("href", "/api/recipes/test-recipe/pdf");
    expect(link).toHaveAttribute("download");
  });

  it("still renders the existing Print button", () => {
    render(<RecipePrintShareBar url="https://oristor.com/recipes/test-recipe" title="Test Recipe" recipeSlug="test-recipe" />);
    expect(screen.getByRole("button", { name: "Print" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run recipe-print-share-bar`
Expected: PASS (2 tests). If an existing test file references `RecipePrintShareBar` without the new `recipeSlug` prop (check with `grep -rl RecipePrintShareBar tests/unit`), update its render call the same way Step 2 did.

- [ ] **Step 5: Commit**

```bash
git add src/components/storefront/recipes/recipe-print-share-bar.tsx src/components/storefront/recipes/recipe-detail-view.tsx tests/unit/recipe-print-share-bar.test.tsx
git commit -m "feat: add Download PDF button to the recipe print/share bar"
```

---

## Task 9: Seed data — categories, sample resources, and generated placeholder PDFs

**Files:**
- Create: `prisma/seed-downloads.ts`
- Modify: `prisma/seed.ts`

**Interfaces:**
- Consumes: `renderRecipePdf`-style rendering primitives from `@react-pdf/renderer` directly (a simple one-off document, not `recipe-pdf.service.ts` — these are generic guide PDFs, not recipe PDFs); `prisma` from `@/lib/db`.
- Produces: `seedDownloads(): Promise<{ categories: number; resources: number }>`, imported and called by `prisma/seed.ts` the same way `seedBlog`/`seedCookingTips`/`seedFoodAcademy`/`seedRecipes` already are.

**Seed scope note:** no "Recipe Cards" category/resources are seeded here — a static recipe-card PDF in the library would contradict Task 6's design (the real recipe PDF is always generated fresh, so a stored one would go stale). This seeds three realistic categories a food brand's resource library would actually have: Nutrition Guides, Ingredient Guides, and Brand & Company.

- [ ] **Step 1: Write `prisma/seed-downloads.ts`**

```typescript
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Document, Page, renderToBuffer, StyleSheet, Text } from "@react-pdf/renderer";

import { prisma } from "../src/lib/db";

const DOWNLOADS_DIR = path.join(process.cwd(), "public", "downloads");

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12 },
  title: { fontSize: 24, marginBottom: 12 },
  body: { fontSize: 11, lineHeight: 1.5 },
});

function PlaceholderDocument({ title, body }: { title: string; body: string }) {
  return (
    <Document title={title}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </Page>
    </Document>
  );
}

async function writePlaceholderPdf(fileName: string, title: string, body: string): Promise<number> {
  const buffer = await renderToBuffer(<PlaceholderDocument title={title} body={body} />);
  await mkdir(DOWNLOADS_DIR, { recursive: true });
  await writeFile(path.join(DOWNLOADS_DIR, fileName), buffer);
  return buffer.length;
}

const categorySeeds = [
  { name: "Nutrition Guides", slug: "nutrition-guides", sortOrder: 0 },
  { name: "Ingredient Guides", slug: "ingredient-guides", sortOrder: 1 },
  { name: "Brand & Company", slug: "brand-company", sortOrder: 2 },
];

const resourceSeeds = [
  {
    categorySlug: "nutrition-guides",
    slug: "understanding-nutrition-labels",
    title: "Understanding Nutrition Labels",
    description: "A short guide to reading the nutrition panel on Oristor products.",
    fileName: "understanding-nutrition-labels.pdf",
    body: "Learn how to read calories, macronutrients, and sodium content on Oristor's nutrition panels, and how they relate to daily recommended values.",
    thumbnailUrl: "/images/products/export/curry-powder.webp",
  },
  {
    categorySlug: "ingredient-guides",
    slug: "sri-lankan-spice-glossary",
    title: "Sri Lankan Spice Glossary",
    description: "An illustrated glossary of the spices used across Oristor's recipes.",
    fileName: "sri-lankan-spice-glossary.pdf",
    body: "A reference glossary covering the roasted curry powders, sambols, and spice blends used throughout Oristor's recipe collection.",
    thumbnailUrl: "/images/products/export/curry-powder.webp",
  },
  {
    categorySlug: "brand-company",
    slug: "the-oristor-story",
    title: "The Oristor Story",
    description: "Our brand story, values, and sourcing commitments.",
    fileName: "the-oristor-story.pdf",
    body: "Oristor — Feel the Difference. A short brochure on our origins, brand values, and commitment to authentic Sri Lankan food.",
    thumbnailUrl: "/images/products/export/curry-powder.webp",
  },
] as const;

export async function seedDownloads(): Promise<{ categories: number; resources: number }> {
  const categoriesBySlug = new Map<string, string>();
  for (const category of categorySeeds) {
    const row = await prisma.downloadCategory.upsert({
      where: { slug: category.slug },
      update: { name: category.name, sortOrder: category.sortOrder },
      create: category,
    });
    categoriesBySlug.set(category.slug, row.id);
  }

  for (const resource of resourceSeeds) {
    const fileSizeBytes = await writePlaceholderPdf(resource.fileName, resource.title, resource.body);
    const categoryId = categoriesBySlug.get(resource.categorySlug);
    if (!categoryId) throw new Error(`Unknown category slug in resourceSeeds: ${resource.categorySlug}`);

    await prisma.downloadResource.upsert({
      where: { slug: resource.slug },
      update: {
        title: resource.title,
        description: resource.description,
        thumbnailUrl: resource.thumbnailUrl,
        fileUrl: `/downloads/${resource.fileName}`,
        fileType: "PDF",
        fileSizeBytes,
        categoryId,
        status: "Published",
      },
      create: {
        slug: resource.slug,
        title: resource.title,
        description: resource.description,
        thumbnailUrl: resource.thumbnailUrl,
        fileUrl: `/downloads/${resource.fileName}`,
        fileType: "PDF",
        fileSizeBytes,
        categoryId,
        status: "Published",
      },
    });
  }

  return { categories: categorySeeds.length, resources: resourceSeeds.length };
}
```

- [ ] **Step 2: Wire `seedDownloads` into `prisma/seed.ts`**

Add the import near the other `seed*` imports:

```typescript
import { seedDownloads } from "./seed-downloads";
```

Add the call near where `seedBlog()`/`seedCookingTips()`/`seedFoodAcademy()` are already called (check `prisma/seed.ts` for their exact call site — add `const downloads = await seedDownloads();` alongside them), and add `downloads` to the final summary object the script logs (matching how `blog`/`cookingTips`/`foodAcademy` already appear there).

- [ ] **Step 3: Run the seed and verify**

```bash
npx tsx --env-file=.env prisma/seed.ts
```

Expected: the summary output now includes a `downloads: { categories: 3, resources: 3 }` entry (or wherever you placed it in the logged object).

```bash
ls public/downloads
```

Expected: three `.pdf` files.

- [ ] **Step 4: Commit**

```bash
git add prisma/seed-downloads.ts prisma/seed.ts public/downloads
git commit -m "feat: seed download categories and sample resources"
```

---

## Task 10: Playwright e2e tests

**Files:**
- Create: `tests/e2e/downloads.spec.ts`
- Create: `tests/e2e/recipe-pdf.spec.ts`

**Interfaces:**
- Consumes: `prisma` from `@/lib/db` (seeding fixtures directly, matching every other e2e spec's convention); `createRecipe`/`createRecipeCategory` from `@/repositories/recipe.repository` (existing).
- Produces: nothing consumed by later tasks — this is the final functional task before documentation.

- [ ] **Step 1: Write `tests/e2e/downloads.spec.ts`**

```typescript
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { prisma } from "@/lib/db";

const CATEGORY_SLUG_PREFIX = "e2e-downloads-";
const RESOURCE_SLUG_PREFIX = "e2e-downloads-";

async function seedCategory(n: number, name: string) {
  return prisma.downloadCategory.create({ data: { name, slug: `${CATEGORY_SLUG_PREFIX}${n}`, sortOrder: n } });
}

async function seedResource(n: number, categoryId: string, title: string) {
  return prisma.downloadResource.create({
    data: {
      slug: `${RESOURCE_SLUG_PREFIX}${n}`,
      title,
      thumbnailUrl: "/images/products/export/curry-powder.webp",
      fileUrl: `/downloads/e2e-test-${n}.pdf`,
      fileType: "PDF",
      fileSizeBytes: 204_800,
      categoryId,
      status: "Published",
    },
  });
}

test.describe("Downloads & Resources", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    await prisma.downloadResource.deleteMany({ where: { slug: { startsWith: RESOURCE_SLUG_PREFIX } } });
    await prisma.downloadCategory.deleteMany({ where: { slug: { startsWith: CATEGORY_SLUG_PREFIX } } });
  });

  test("browsing /downloads shows resources, filterable by category", async ({ page }) => {
    const categoryA = await seedCategory(1, "E2E Guides");
    const categoryB = await seedCategory(2, "E2E Brand");
    await seedResource(1, categoryA.id, "E2E Guide Resource");
    await seedResource(2, categoryB.id, "E2E Brand Resource");

    await page.goto("/downloads");
    await expect(page.getByText("E2E Guide Resource")).toBeVisible();
    await expect(page.getByText("E2E Brand Resource")).toBeVisible();

    await page.getByRole("link", { name: "E2E Guides" }).click();
    await expect(page).toHaveURL(/category=e2e-downloads-1/);
    await expect(page.getByText("E2E Guide Resource")).toBeVisible();
    await expect(page.getByText("E2E Brand Resource")).not.toBeVisible();
  });

  test("downloading a resource succeeds and its listed count increases on reload", async ({ page }) => {
    const category = await seedCategory(3, "E2E Count Category");
    const resource = await seedResource(3, category.id, "E2E Count Resource");

    const response = await page.request.get(`/api/downloads/${resource.slug}/file`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-disposition"]).toContain("attachment");

    const refreshed = await prisma.downloadResource.findUniqueOrThrow({ where: { id: resource.id } });
    expect(refreshed.downloadCount).toBe(1);
  });

  test("the downloads grid has no detectable accessibility violations", async ({ page }) => {
    const category = await seedCategory(4, "E2E A11y Category");
    await seedResource(4, category.id, "E2E A11y Resource");

    await page.goto("/downloads");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
```

- [ ] **Step 2: Write `tests/e2e/recipe-pdf.spec.ts`**

```typescript
import { expect, test } from "@playwright/test";

import { computeTotalTimeMinutes } from "@/lib/recipe-time";
import { createRecipe, createRecipeCategory } from "@/repositories/recipe.repository";

const CATEGORY_SLUG_PREFIX = "e2e-recipe-pdf-";
const RECIPE_SLUG_PREFIX = "e2e-recipe-pdf-";

test.describe("Recipe PDF download", () => {
  test("downloading a recipe's PDF returns a valid application/pdf response", async ({ page }) => {
    const category = await createRecipeCategory({ name: "E2E PDF Category", slug: `${CATEGORY_SLUG_PREFIX}1` });
    const recipe = await createRecipe({
      slug: `${RECIPE_SLUG_PREFIX}1`,
      title: "E2E PDF Curry",
      shortDescription: "A test recipe for the PDF e2e suite.",
      heroImage: "/images/products/export/curry-powder.webp",
      heroImageAlt: "Test hero image",
      categoryId: category.id,
      difficulty: "Easy",
      prepTimeMinutes: 10,
      cookTimeMinutes: 20,
      totalTimeMinutes: computeTotalTimeMinutes(10, 20),
      servings: 4,
      status: "Published",
      publishedAt: new Date(),
    });

    await page.goto(`/recipes/${recipe.slug}`);
    const downloadLink = page.getByRole("link", { name: `Download ${recipe.title} recipe card as a PDF` });
    await expect(downloadLink).toHaveAttribute("href", `/api/recipes/${recipe.slug}/pdf`);

    const response = await page.request.get(`/api/recipes/${recipe.slug}/pdf`);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("application/pdf");
    const body = await response.body();
    expect(body.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
```

- [ ] **Step 3: Run the e2e suites**

```bash
npx playwright test tests/e2e/downloads.spec.ts tests/e2e/recipe-pdf.spec.ts --workers=1
```
Expected: PASS (all tests). Ensure `npx prisma dev` is running and the DB is seeded first (`npx tsx --env-file=.env prisma/seed.ts`) — the downloads e2e suite reads/writes real `DownloadResource` rows and the seeded placeholder files under `public/downloads/` don't need to exist for its own fixtures (each test creates its own), but a stale/missing `public/downloads/` directory from a fresh clone won't block these tests either way, since Task 9's seed step already created it.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/downloads.spec.ts tests/e2e/recipe-pdf.spec.ts
git commit -m "test: add downloads and recipe PDF e2e coverage"
```

---

## Task 11: Documentation

**Files:**
- Modify: `docs/architecture-decisions.md`

**Interfaces:**
- Consumes: nothing (documentation only).
- Produces: nothing consumed by later tasks — this is the plan's final task.

- [ ] **Step 1: Append a new dated entry to `docs/architecture-decisions.md`**

Add this at the end of the file (preceded by a blank line and a `---` separator, matching every other entry boundary):

```markdown
---

## 2026-09-27 — STORY-023 Downloads & Resources

**File storage for `DownloadResource` is local `public/downloads/`, not
cloud storage — this is a deliberate, documented placeholder, not an
oversight.** No cloud storage provider (S3/Cloudinary/etc.) is decided
anywhere in this project (`docs/blueprint.md` Section 10 lists
"hosting/cloud provider specifics" as an open item), and every existing
image asset in this codebase is already a plain `public/images/...` path
with the same limitation. `DownloadResource.fileUrl`/`.thumbnailUrl` follow
that same convention. **The swap point when a provider is chosen:**
`fileUrl` becomes a full external URL, and
`/api/downloads/[slug]/file/route.ts`'s single `readFile(path.join(...,
resource.fileUrl))` call becomes a `fetch(resource.fileUrl)` instead — no
schema change, and the route's `resolveFileAccess`/`recordDownload` call
sites either side of it are unaffected.

**PDF generation uses `@react-pdf/renderer`, not headless-Chromium
print-to-PDF, despite Playwright already being a devDependency.** Chosen
because it needs no browser binary in production — this project's hosting
target is still an open item (blueprint Section 10), and a
headless-Chromium requirement would have constrained that unrelated,
future decision. `recipe-pdf.service.ts`'s recipe-card PDF and
`prisma/seed-downloads.ts`'s placeholder guide PDFs both use it directly.
The trade-off: `@react-pdf/renderer` has its own `StyleSheet` API, so none
of the storefront's Tailwind classes carry over — the recipe PDF is a
second, independent rendering of the recipe, not a reuse of STORY-018's
`print:hidden`-CSS browser-print view. **Fonts:** the web app's
`next/font/google` mechanism is a build-time CSS optimization
`@react-pdf/renderer` cannot consume — it needs real font files, registered
via `Font.register()`. This story adds `@fontsource/inter` and
`@fontsource/cormorant-garamond` as dependencies (not devDependencies —
needed at request time) purely to get at their bundled `.woff` files;
`recipe-pdf.service.ts` registers three weights (`Inter` 400/600/700,
`Cormorant Garamond` 700) once at module load, styled with the brand hex
values from `docs/blueprint.md` Section 2.

**`downloadCount` increments via the same raw-`$executeRaw`-UPDATE shape as
`Recipe.viewCount`** (`recipe.repository.ts`'s `incrementRecipeViewCount`)
— reused verbatim, not just in spirit, specifically so the increment
doesn't also bump `@updatedAt` (a download is not a content edit). This is
now the second use of this exact pattern in the codebase; any future
counter needing the same atomicity-without-touching-`updatedAt` guarantee
(e.g. a future product/recipe share-count, or STORY-047/STORY-036's future
invoice/packing-slip PDF download tracking, both of which currently
reference PDF generation with no implementation of their own) should reuse
this shape rather than inventing a new one.

**A generated recipe PDF is intentionally not a `DownloadResource` row.**
It has no counter, is never listed on `/downloads`, and is regenerated
fresh on every `GET /api/recipes/[slug]/pdf` request rather than cached —
`@react-pdf/renderer`'s render time for a one-page structured document is
small, and caching would add invalidation complexity (servings/ingredients
can change) for no measured benefit.

**Recipe PDF v1 renders text only — no embedded hero photo.** The AC's
"ingredients + method, respecting the brand's visual identity" doesn't
require the photo, and `@react-pdf/renderer`'s `<Image>` embedding adds a
second filesystem-read path and image-format-compatibility surface for no
AC-required behavior. `recipe.heroImage` is already available on the
`RecipeDetail` `recipe-pdf.service.ts` receives, so adding it later is a
small, additive change, not a re-architecture.
```

- [ ] **Step 2: Commit**

```bash
git add docs/architecture-decisions.md
git commit -m "docs: document storage/PDF-generation decisions and the downloadCount pattern for STORY-023"
```

---

## Final Verification

After all 11 tasks are complete:

- [ ] `npx tsc --noEmit -p tsconfig.json` — no errors.
- [ ] `npm run lint` — no errors.
- [ ] `npm run test` (with `npx prisma dev` running, freshly restarted) — full suite passes, including every file this plan added.
- [ ] `npm run test:e2e` — full suite passes, including `downloads.spec.ts` and `recipe-pdf.spec.ts`.
- [ ] Manually re-verify in the browser: `/downloads` shows the three seeded resources with working category filters; clicking Download actually downloads a PDF; a recipe detail page shows the new "Download PDF" button next to Print, and clicking it downloads a real, brand-styled PDF with the recipe's ingredients and method.
- [ ] Re-read the design spec (`docs/superpowers/specs/2026-09-27-downloads-resources-design.md`) once more against the finished code — confirm every numbered decision (1 through 13) has a corresponding implementation.
