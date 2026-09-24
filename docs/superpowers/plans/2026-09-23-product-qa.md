# Product Q&A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let signed-in customers ask product questions (stored as `Pending`, firing a notify-admin hook), show only `Published` question+answer pairs on the PDP with a keyword search and pagination, and show each asker their own questions still awaiting an answer.

**Architecture:** A `Question` aggregate with the official answer stored as fields on the row. `qa.repository.ts` owns all Prisma access (conditional writes); `qa.service.ts` owns the rules, including `answerQuestion` and `changeQuestionStatus`, the only ways a status changes (STORY-046's entry points). `qa-notifications.ts` is a `globalThis` hook registry that STORY-032 will fill (it logs for now); the hooks fire after the write and never throw. The PDP gets data through the existing `registerQaSummaryProvider` hook, registered from `src/instrumentation.ts` next to reviews.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Prisma 7 (`@prisma/adapter-pg`), Zod 4, React Hook Form + `@hookform/resolvers`, TanStack Query 5, NextAuth v5 (`useSession`), Base UI / shadcn components, Vitest + Testing Library, Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-09-23-product-qa-design.md`

## Global Constraints

- Branch `feature/story-016-product-qa`, worktree `.claude/worktrees/story-016-product-qa`, based on `feature/story-015-product-reviews`.
- Only files in `src/repositories/` may import `@/lib/db`. Services may import from `@/generated/prisma/client` for types/error classes only.
- No `any`. TypeScript strict. `npx tsc --noEmit` covers `tests/` too.
- Question status values are exactly `Pending`, `Answered`, `Approved`, `Published`, `Rejected`.
- Allowed transitions: Pending→Answered (only via `answerQuestion`), Pending→Rejected, Answered→Approved, Answered→Rejected, Approved→Published, Approved→Rejected, Published→Rejected. `changeQuestionStatus` never accepts `Answered`.
- Question text: trimmed, 10–500 characters. Answer text: trimmed, 1–2000 characters. Search `q`: trimmed, max 100 characters; blank means no filter.
- List query defaults: `page=1`, `pageSize=10` (max 50). Public list: `Published` only, ordered `publishedAt desc, id asc`.
- Keyword filter: split `q` on whitespace; every word must appear (case-insensitive) in the question text OR its answer text.
- "My open questions" = the signed-in user's own `Pending`, `Answered` and `Approved` questions on that product (never `Published`, never `Rejected`, never other users').
- No uniqueness limit: a customer may have any number of open questions per product.
- Notify hooks fire only after a successful write, and never throw into the caller (errors are caught and `console.error`ed). The default notifier `console.info`s a line starting `[qa-notify]`. **Unit tests must not produce console noise.** Register a recording notifier, or `vi.spyOn(console, "info"/"error").mockImplementation(() => {})` where the default or a failure is under test.
- Error response body shape: `{ error: string, fieldErrors?: Record<string, string[]> }`.
- The PDP empty state contains the text `No questions yet.` exactly once on the page (`tests/e2e/product-detail.spec.ts` asserts it under Playwright's strict mode).
- Seed demo Q&A must NOT be on `roasted-curry-powder-100g`.
- Commits: Conventional Commits, ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Local DB:** PGlite `prisma dev` on port 51214; this worktree's `.env` has `DATABASE_POOL_MAX=1`. Run database-backed test files one command at a time. If a run fails with `P1001`, `ConnectionClosed` or `Connection terminated unexpectedly`, that's the documented PGlite limitation: report it rather than changing code. Only the controller restarts the DB (Task 11 has its own restart procedure).

---

## File map

| File | Responsibility |
|---|---|
| `prisma/schema.prisma` | `QuestionStatus`, `Question`, relations on `User` and `Product` |
| `prisma/migrations/20260923180000_add_questions/migration.sql` | The committed migration |
| `src/types/question.ts` | Client-safe types and constants |
| `src/validation/question.schema.ts` | `questionInputSchema`, `answerTextSchema`, `questionListQuerySchema` |
| `src/repositories/qa.repository.ts` | All question Prisma access, with conditional writes |
| `src/services/qa.errors.ts` | Typed service errors |
| `src/services/qa-notifications.ts` | Notify-admin / notify-customer hook registry (`globalThis`) |
| `src/services/qa.service.ts` | Lifecycle, customer actions, listing, PDP provider, dev publish helper |
| `src/services/product-detail-extensions.ts` | `QaPreview` becomes `PublicQuestion` |
| `src/instrumentation.ts` | Also registers the Q&A provider |
| `src/lib/api/responses.ts` | Shared `unauthorizedResponse` / `validationErrorResponse` (moved from review-responses) |
| `src/lib/api/qa-responses.ts` | Maps Q&A service errors to HTTP |
| `src/app/api/products/[slug]/questions/route.ts` | GET list, POST submit |
| `src/app/api/products/[slug]/questions/mine/route.ts` | GET own open questions |
| `src/lib/api/api-error.ts` | Generic `ApiError` + `readApiError` for browser clients |
| `src/lib/api/question-client.ts` | Browser fetch wrappers for questions |
| `src/lib/format-date.ts` | Shared hydration-safe date formatter (reviews switch to it too) |
| `src/components/storefront/product/questions/*` | `QuestionsSection`, `QaSearch`, `QaList`, `MyOpenQuestions`, `AskQuestionForm` |
| `src/app/(storefront)/products/[slug]/page.tsx` | Uses `QuestionsSection` |
| `scripts/publish-question.ts` | Dev-only CLI: `npm run qa:publish -- <questionId> "<answer text>"` |
| `prisma/seed.ts` | Demo Q&A, published through the service |

---

### Task 1: Schema and migration

**Files:**
- Modify: `prisma/schema.prisma` (`User` model; `Product` model; append new enum and model at the end)
- Create: `prisma/migrations/20260923180000_add_questions/migration.sql`

**Interfaces:**
- Produces: the Prisma model `question`, enum `QuestionStatus`, relations `User.questions`/`User.answeredQuestions`/`Product.questions`.

- [ ] **Step 1: Add relation fields to `User`**

In `model User`, directly after the `moderatedReviews` line, add the two lines below. Keep the `User` block's existing column alignment: align the field-name and type columns with the rest of the block, widening them for the whole block if a new name is the longest.

```prisma
  questions         Question[] @relation("QuestionAsker")
  answeredQuestions Question[] @relation("QuestionAnswerer")
```

- [ ] **Step 2: Add the relation field to `Product`**

In `model Product`, directly after `ratingSummary       ProductRatingSummary?`, add (aligned with that block):

```prisma
  questions           Question[]
```

- [ ] **Step 3: Append at the end of `prisma/schema.prisma`**

```prisma
// STORY-016. Lifecycle and transitions: see
// docs/superpowers/specs/2026-09-23-product-qa-design.md. Status only changes
// through qa.service.ts's answerQuestion() / changeQuestionStatus().
enum QuestionStatus {
  Pending
  Answered
  Approved
  Published
  Rejected
}

model Question {
  id        String         @id @default(cuid())
  productId String
  product   Product        @relation(fields: [productId], references: [id], onDelete: Cascade)
  userId    String
  user      User           @relation("QuestionAsker", fields: [userId], references: [id], onDelete: Cascade)
  text      String
  status    QuestionStatus @default(Pending)

  // The official answer. Reserved for STORY-046, which sets all three
  // together through answerQuestion() on Pending → Answered.
  answerText   String?
  answeredById String?
  answeredBy   User?     @relation("QuestionAnswerer", fields: [answeredById], references: [id], onDelete: SetNull)
  answeredAt   DateTime?

  publishedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([productId, status, publishedAt])
  @@index([productId, userId, status])
}
```

- [ ] **Step 4: Format check and validate**

Run: `npx prisma validate`
Expected: `The schema at prisma\schema.prisma is valid 🚀`

Then run `git diff prisma/schema.prisma` and confirm only the `User` block (if you widened it), the one `Product` line, and the appended enum/model changed. Do not run `prisma format` on the whole file.

- [ ] **Step 5: Generate the migration offline**

```bash
git show HEAD:prisma/schema.prisma > "$TEMP/schema-before-questions.prisma"
mkdir -p prisma/migrations/20260923180000_add_questions
npx prisma migrate diff --from-schema "$TEMP/schema-before-questions.prisma" --to-schema prisma/schema.prisma --script > prisma/migrations/20260923180000_add_questions/migration.sql
head -3 prisma/migrations/20260923180000_add_questions/migration.sql
grep -cE 'CREATE TYPE "QuestionStatus"|CREATE TABLE "Question"|CREATE INDEX "Question_productId_status_publishedAt_idx"|CREATE INDEX "Question_productId_userId_status_idx"' prisma/migrations/20260923180000_add_questions/migration.sql
```

Expected: the first line is `-- CreateEnum` and the count is `4`. If a `Loaded Prisma config` line appears at the top of the file, delete it.

- [ ] **Step 6: Apply locally and regenerate the client**

```bash
npx prisma generate
npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 7: Typecheck and commit**

```bash
npx tsc --noEmit
git add prisma/schema.prisma prisma/migrations/20260923180000_add_questions/migration.sql
git commit -m "feat: add Question model for product Q&A" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Expected: `tsc` prints nothing.

---

### Task 2: Shared types and validation schemas

**Files:**
- Create: `src/types/question.ts`
- Create: `src/validation/question.schema.ts`
- Test: `tests/unit/question-schema.test.ts`

**Interfaces:**
- Produces (`src/types/question.ts`, client-safe, no imports): `QuestionStatusValue`, `PublicQuestion`, `QuestionPage`, `OwnQuestion`, `QUESTION_PAGE_SIZE`, `QuestionPageQuery`.
- Produces (`src/validation/question.schema.ts`): `questionInputSchema`, `QuestionInput`, `answerTextSchema`, `questionListQuerySchema`, `QuestionListQuery`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/question-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { answerTextSchema, questionInputSchema, questionListQuerySchema } from "@/validation/question.schema";

describe("questionInputSchema", () => {
  it("accepts a valid question and trims it", () => {
    expect(questionInputSchema.parse({ text: "  Is this chilli very hot?  " })).toEqual({ text: "Is this chilli very hot?" });
  });

  it("measures length after trimming (10–500)", () => {
    expect(questionInputSchema.safeParse({ text: `  ${"a".repeat(9)}  ` }).success).toBe(false);
    expect(questionInputSchema.safeParse({ text: "a".repeat(10) }).success).toBe(true);
    expect(questionInputSchema.safeParse({ text: "a".repeat(501) }).success).toBe(false);
  });

  it("gives a friendly message when too short", () => {
    expect(questionInputSchema.safeParse({ text: "Hot?" }).error?.issues[0]?.message).toBe(
      "Question must be at least 10 characters",
    );
  });
});

describe("answerTextSchema", () => {
  it("trims and requires 1–2000 characters", () => {
    expect(answerTextSchema.parse("  Yes.  ")).toBe("Yes.");
    expect(answerTextSchema.safeParse("   ").success).toBe(false);
    expect(answerTextSchema.safeParse("a".repeat(2001)).success).toBe(false);
  });
});

describe("questionListQuerySchema", () => {
  it("applies defaults", () => {
    expect(questionListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 10 });
  });

  it("coerces params and trims q", () => {
    expect(questionListQuerySchema.parse({ page: "2", pageSize: "20", q: "  storage tips " })).toEqual({
      page: 2,
      pageSize: 20,
      q: "storage tips",
    });
  });

  it("treats a blank q as no filter", () => {
    expect(questionListQuerySchema.parse({ q: "   " }).q).toBeUndefined();
  });

  it.each([{ pageSize: "51" }, { page: "0" }, { q: "a".repeat(101) }])("rejects %o", (query) => {
    expect(questionListQuerySchema.safeParse(query).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/question-schema.test.ts`
Expected: FAIL, `Failed to resolve import "@/validation/question.schema"`.

- [ ] **Step 3: Create `src/types/question.ts`**

```ts
/**
 * Product Q&A types and constants shared by server and client code
 * (STORY-016). Keep this file free of server-only imports: client components
 * import from it.
 */

export type QuestionStatusValue = "Pending" | "Answered" | "Approved" | "Published" | "Rejected";

/** A Published question with its answer, as returned by the public API. */
export interface PublicQuestion {
  id: string;
  question: string;
  answer: string;
  /** ISO 8601 string. */
  publishedAt: string;
}

export interface QuestionPage {
  items: PublicQuestion[];
  total: number;
  page: number;
  pageSize: number;
}

/** The signed-in customer's own question. */
export interface OwnQuestion {
  id: string;
  text: string;
  status: QuestionStatusValue;
  /** ISO 8601 string. */
  createdAt: string;
}

export const QUESTION_PAGE_SIZE = 10;

export interface QuestionPageQuery {
  page: number;
  pageSize: number;
  q?: string;
}
```

- [ ] **Step 4: Create `src/validation/question.schema.ts`**

```ts
import { z } from "zod";

import { QUESTION_PAGE_SIZE } from "@/types/question";

/** Shared by AskQuestionForm (client) and POST /questions (server). */
export const questionInputSchema = z.object({
  text: z
    .string()
    .trim()
    .min(10, "Question must be at least 10 characters")
    .max(500, "Question must be 500 characters or fewer"),
});

export type QuestionInput = z.infer<typeof questionInputSchema>;

/** The staff answer (STORY-046, and the dev publish path). */
export const answerTextSchema = z
  .string()
  .trim()
  .min(1, "Answer can't be empty")
  .max(2000, "Answer must be 2,000 characters or fewer");

export const questionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(QUESTION_PAGE_SIZE),
  q: z
    .string()
    .trim()
    .max(100, "Search must be 100 characters or fewer")
    .optional()
    .transform((value) => value || undefined),
});

export type QuestionListQuery = z.infer<typeof questionListQuerySchema>;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/unit/question-schema.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/types/question.ts src/validation/question.schema.ts tests/unit/question-schema.test.ts
git commit -m "feat: add product Q&A types and validation schemas" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Q&A repository

**Files:**
- Create: `src/repositories/qa.repository.ts`
- Test: `tests/unit/qa-repository.test.ts`

**Interfaces:**
- Consumes: the Task 1 model.
- Produces:
  - `createQuestion(data: { productId: string; userId: string; text: string }): Promise<Question>`
  - `findQuestionById(id: string): Promise<Question | null>`
  - `listPublishedQuestions(productId: string, query: PublishedQuestionQuery): Promise<{ items: Question[]; total: number }>`, where `PublishedQuestionQuery = { words: string[]; skip: number; take: number }`
  - `listOpenQuestionsByUser(productId: string, userId: string): Promise<Question[]>`
  - `answerPendingQuestion(id: string, data: { answerText: string; answeredById: string | null; answeredAt: Date }): Promise<Question | null>`
  - `updateQuestionStatus(id: string, fromStatus: QuestionStatus, data: QuestionStatusUpdate): Promise<Question | null>`, where `QuestionStatusUpdate = { status: QuestionStatus; publishedAt?: Date }`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/qa-repository.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { QuestionStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import {
  answerPendingQuestion,
  createQuestion,
  findQuestionById,
  listOpenQuestionsByUser,
  listPublishedQuestions,
  updateQuestionStatus,
} from "@/repositories/qa.repository";

let sequence = 0;

async function makeProduct() {
  sequence += 1;
  return createProduct({ sku: `QA-REPO-${sequence}`, slug: `qa-repo-${sequence}`, name: "Chilli Powder", status: "Published" });
}

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `qa-repo-${sequence}@test.com`, name: "Asker" } });
}

/** Test fixture: writes a question in any state directly. */
async function makeQuestion(
  productId: string,
  userId: string,
  overrides: { status?: QuestionStatus; text?: string; answerText?: string; publishedAt?: Date } = {},
) {
  return prisma.question.create({
    data: {
      productId,
      userId,
      text: overrides.text ?? "How spicy is this blend?",
      status: overrides.status ?? "Pending",
      answerText: overrides.answerText ?? null,
      publishedAt: overrides.publishedAt ?? null,
    },
  });
}

afterEach(async () => {
  await prisma.question.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
});

describe("createQuestion / findQuestionById", () => {
  it("creates Pending questions and allows several from the same customer on one product", async () => {
    const product = await makeProduct();
    const user = await makeUser();

    const first = await createQuestion({ productId: product.id, userId: user.id, text: "Is it gluten free?" });
    const second = await createQuestion({ productId: product.id, userId: user.id, text: "Where is it made?" });

    expect(first.status).toBe("Pending");
    expect(second.status).toBe("Pending");
    expect((await findQuestionById(first.id))?.text).toBe("Is it gluten free?");
  });
});

describe("listPublishedQuestions", () => {
  it("returns only Published questions, newest first, with total", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    await makeQuestion(product.id, user.id, { status: "Approved", answerText: "Yes" });
    const older = await makeQuestion(product.id, user.id, { status: "Published", answerText: "A", publishedAt: new Date("2026-01-01") });
    const newer = await makeQuestion(product.id, user.id, { status: "Published", answerText: "B", publishedAt: new Date("2026-02-01") });

    const result = await listPublishedQuestions(product.id, { words: [], skip: 0, take: 10 });

    expect(result.total).toBe(2);
    expect(result.items.map((item) => item.id)).toEqual([newer.id, older.id]);
  });

  it("requires every word to match the question or answer, case-insensitively", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    const storage = await makeQuestion(product.id, user.id, {
      status: "Published",
      text: "How should I STORE it?",
      answerText: "Airtight jar, away from sunlight.",
      publishedAt: new Date(),
    });
    await makeQuestion(product.id, user.id, {
      status: "Published",
      text: "Is it very hot?",
      answerText: "Medium heat.",
      publishedAt: new Date(),
    });

    const byQuestion = await listPublishedQuestions(product.id, { words: ["store"], skip: 0, take: 10 });
    const acrossFields = await listPublishedQuestions(product.id, { words: ["store", "SUNLIGHT"], skip: 0, take: 10 });
    const noMatch = await listPublishedQuestions(product.id, { words: ["store", "hot"], skip: 0, take: 10 });

    expect(byQuestion.items.map((item) => item.id)).toEqual([storage.id]);
    expect(acrossFields.items.map((item) => item.id)).toEqual([storage.id]);
    expect(noMatch.total).toBe(0);
  });

  it("paginates with skip and take", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    for (let day = 1; day <= 3; day += 1) {
      await makeQuestion(product.id, user.id, { status: "Published", answerText: "Ok", publishedAt: new Date(`2026-03-0${day}`) });
    }

    const secondPage = await listPublishedQuestions(product.id, { words: [], skip: 2, take: 2 });

    expect(secondPage.total).toBe(3);
    expect(secondPage.items).toHaveLength(1);
  });
});

describe("listOpenQuestionsByUser", () => {
  it("returns only the user's Pending, Answered and Approved questions on that product", async () => {
    const product = await makeProduct();
    const otherProduct = await makeProduct();
    const user = await makeUser();
    const otherUser = await makeUser();
    const pending = await makeQuestion(product.id, user.id, { status: "Pending" });
    const answered = await makeQuestion(product.id, user.id, { status: "Answered", answerText: "Yes" });
    const approved = await makeQuestion(product.id, user.id, { status: "Approved", answerText: "Yes" });
    await makeQuestion(product.id, user.id, { status: "Published", answerText: "Yes", publishedAt: new Date() });
    await makeQuestion(product.id, user.id, { status: "Rejected" });
    await makeQuestion(product.id, otherUser.id, { status: "Pending" });
    await makeQuestion(otherProduct.id, user.id, { status: "Pending" });

    const open = await listOpenQuestionsByUser(product.id, user.id);

    expect(open.map((question) => question.id).sort()).toEqual([pending.id, answered.id, approved.id].sort());
  });
});

describe("answerPendingQuestion", () => {
  it("sets the answer fields and Answered status on a Pending question", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    const staff = await makeUser();
    const question = await makeQuestion(product.id, user.id);
    const answeredAt = new Date();

    const answered = await answerPendingQuestion(question.id, { answerText: "Yes, it is.", answeredById: staff.id, answeredAt });

    expect(answered).toMatchObject({ status: "Answered", answerText: "Yes, it is.", answeredById: staff.id });
  });

  it("returns null and changes nothing when the question is no longer Pending", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    const question = await makeQuestion(product.id, user.id, { status: "Rejected" });

    const result = await answerPendingQuestion(question.id, { answerText: "Late", answeredById: null, answeredAt: new Date() });

    expect(result).toBeNull();
    expect(await findQuestionById(question.id)).toMatchObject({ status: "Rejected", answerText: null });
  });
});

describe("updateQuestionStatus", () => {
  it("updates when the current status matches fromStatus", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    const question = await makeQuestion(product.id, user.id, { status: "Approved", answerText: "Yes" });
    const publishedAt = new Date();

    const updated = await updateQuestionStatus(question.id, "Approved", { status: "Published", publishedAt });

    expect(updated?.status).toBe("Published");
    expect(updated?.publishedAt?.toISOString()).toBe(publishedAt.toISOString());
  });

  it("returns null and changes nothing on a stale fromStatus", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    const question = await makeQuestion(product.id, user.id, { status: "Rejected" });

    expect(await updateQuestionStatus(question.id, "Approved", { status: "Published" })).toBeNull();
    expect((await findQuestionById(question.id))?.status).toBe("Rejected");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/qa-repository.test.ts`
Expected: FAIL, `Failed to resolve import "@/repositories/qa.repository"`.

- [ ] **Step 3: Write the repository**

Create `src/repositories/qa.repository.ts`:

```ts
import type { Prisma, QuestionStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export interface PublishedQuestionQuery {
  /** Every word must match the question text or answer text (case-insensitive). */
  words: string[];
  skip: number;
  take: number;
}

export interface QuestionStatusUpdate {
  status: QuestionStatus;
  publishedAt?: Date;
}

const openStatuses: QuestionStatus[] = ["Pending", "Answered", "Approved"];

export function createQuestion(data: { productId: string; userId: string; text: string }) {
  return prisma.question.create({ data });
}

export function findQuestionById(id: string) {
  return prisma.question.findUnique({ where: { id } });
}

function publishedWhere(productId: string, words: string[]): Prisma.QuestionWhereInput {
  return {
    productId,
    status: "Published",
    AND: words.map((word) => ({
      OR: [
        { text: { contains: word, mode: "insensitive" } },
        { answerText: { contains: word, mode: "insensitive" } },
      ],
    })),
  };
}

export async function listPublishedQuestions(productId: string, query: PublishedQuestionQuery) {
  const where = publishedWhere(productId, query.words);
  const [items, total] = await Promise.all([
    prisma.question.findMany({
      where,
      // id breaks ties so pagination never repeats or skips a question.
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      skip: query.skip,
      take: query.take,
    }),
    prisma.question.count({ where }),
  ]);
  return { items, total };
}

export function listOpenQuestionsByUser(productId: string, userId: string) {
  return prisma.question.findMany({
    where: { productId, userId, status: { in: openStatuses } },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
}

/**
 * Pending → Answered, conditional on the question still being Pending (so a
 * concurrent reject can't be overwritten). Returns null when nothing matched.
 */
export async function answerPendingQuestion(
  id: string,
  data: { answerText: string; answeredById: string | null; answeredAt: Date },
) {
  const { count } = await prisma.question.updateMany({
    where: { id, status: "Pending" },
    data: { ...data, status: "Answered" },
  });
  return count === 0 ? null : prisma.question.findUnique({ where: { id } });
}

/** Conditional on the status the caller read; returns null when it changed meanwhile. */
export async function updateQuestionStatus(id: string, fromStatus: QuestionStatus, data: QuestionStatusUpdate) {
  const { count } = await prisma.question.updateMany({ where: { id, status: fromStatus }, data });
  return count === 0 ? null : prisma.question.findUnique({ where: { id } });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/qa-repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/repositories/qa.repository.ts tests/unit/qa-repository.test.ts
git commit -m "feat: add Q&A repository with conditional status writes" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Errors and notification hooks

**Files:**
- Create: `src/services/qa.errors.ts`
- Create: `src/services/qa-notifications.ts`
- Test: `tests/unit/qa-notifications.test.ts`

**Interfaces:**
- Produces (`qa.errors.ts`): `QaErrorCode`, `QaServiceError` (`readonly code`), `InvalidQuestionInputError(message)`, `QaProductNotFoundError()`, `QuestionNotFoundError()`, `InvalidQuestionTransitionError(from, to)`.
- Produces (`qa-notifications.ts`): `QuestionSubmittedEvent`, `QuestionPublishedEvent`, `QaNotifier`, `registerQaNotifier(notifier)`, `notifyQuestionSubmitted(event): Promise<void>`, `notifyQuestionPublished(event): Promise<void>`, `resetQaNotifierForTesting()`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/qa-notifications.test.ts`:

```ts
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  notifyQuestionPublished,
  notifyQuestionSubmitted,
  registerQaNotifier,
  resetQaNotifierForTesting,
  type QuestionPublishedEvent,
  type QuestionSubmittedEvent,
} from "@/services/qa-notifications";

const submitted: QuestionSubmittedEvent = {
  questionId: "q1",
  productId: "p1",
  productSlug: "chilli-powder-100g",
  productName: "Chilli Powder 100g",
  text: "Is it very hot?",
  askedByUserId: "u1",
  submittedAt: new Date("2026-09-23T10:00:00Z"),
};

const published: QuestionPublishedEvent = {
  questionId: "q1",
  productId: "p1",
  productSlug: "chilli-powder-100g",
  productName: "Chilli Powder 100g",
  askedByUserId: "u1",
  publishedAt: new Date("2026-09-24T10:00:00Z"),
};

afterEach(() => {
  resetQaNotifierForTesting();
  vi.restoreAllMocks();
});

describe("default notifier", () => {
  it("logs a [qa-notify] line for each event (temporary fallback until STORY-032)", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    await notifyQuestionSubmitted(submitted);
    await notifyQuestionPublished(published);

    expect(info).toHaveBeenCalledTimes(2);
    expect(String(info.mock.calls[0]?.[0])).toMatch(/^\[qa-notify\] question submitted/);
    expect(String(info.mock.calls[1]?.[0])).toMatch(/^\[qa-notify\] question published/);
  });
});

describe("registered notifier", () => {
  it("receives the events", async () => {
    const onQuestionSubmitted = vi.fn(async () => {});
    const onQuestionPublished = vi.fn(async () => {});
    registerQaNotifier({ onQuestionSubmitted, onQuestionPublished });

    await notifyQuestionSubmitted(submitted);
    await notifyQuestionPublished(published);

    expect(onQuestionSubmitted).toHaveBeenCalledWith(submitted);
    expect(onQuestionPublished).toHaveBeenCalledWith(published);
  });

  it("never throws into the caller when the notifier fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    registerQaNotifier({
      onQuestionSubmitted: async () => {
        throw new Error("SMS gateway down");
      },
      onQuestionPublished: async () => {
        throw new Error("SMS gateway down");
      },
    });

    await expect(notifyQuestionSubmitted(submitted)).resolves.toBeUndefined();
    await expect(notifyQuestionPublished(published)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledTimes(2);
  });

  it("is shared across separately loaded copies of the module", async () => {
    // STORY-032 registers from src/instrumentation.ts, which Next.js bundles
    // separately from route code, so the registry must live on globalThis.
    const first = await import("@/services/qa-notifications");
    vi.resetModules();
    const second = await import("@/services/qa-notifications");
    expect(second).not.toBe(first);
    const onQuestionSubmitted = vi.fn(async () => {});
    first.registerQaNotifier({ onQuestionSubmitted, onQuestionPublished: async () => {} });

    await second.notifyQuestionSubmitted(submitted);

    expect(onQuestionSubmitted).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/qa-notifications.test.ts`
Expected: FAIL, `Failed to resolve import "@/services/qa-notifications"`.

- [ ] **Step 3: Create `src/services/qa.errors.ts`**

```ts
/**
 * Typed errors thrown by qa.service.ts; route handlers map `code` to an HTTP
 * status in src/lib/api/qa-responses.ts.
 */
export type QaErrorCode = "invalid_input" | "product_not_found" | "question_not_found" | "invalid_transition";

export class QaServiceError extends Error {
  readonly code: QaErrorCode;

  constructor(code: QaErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = new.target.name;
  }
}

export class InvalidQuestionInputError extends QaServiceError {
  constructor(message: string) {
    super("invalid_input", message);
  }
}

export class QaProductNotFoundError extends QaServiceError {
  constructor() {
    super("product_not_found", "Product not found");
  }
}

export class QuestionNotFoundError extends QaServiceError {
  constructor() {
    super("question_not_found", "Question not found");
  }
}

export class InvalidQuestionTransitionError extends QaServiceError {
  constructor(from: string, to: string) {
    super("invalid_transition", `A question can't move from ${from} to ${to}`);
  }
}
```

- [ ] **Step 4: Create `src/services/qa-notifications.ts`**

```ts
/**
 * Notification hooks for product Q&A (STORY-016): "notify admin" when a
 * question is submitted, "notify customer" when it is published.
 * STORY-032 (Notifications) registers real email/SMS/WhatsApp delivery with
 * registerQaNotifier() from src/instrumentation.ts. Until then the default
 * notifier just logs a [qa-notify] line — a documented temporary fallback.
 *
 * Contract: qa.service.ts calls notify*() only AFTER the database write has
 * succeeded, and notify*() never throws — a failing notifier is logged, so it
 * can't fail a submission or a publish.
 *
 * Kept on globalThis for the same reason as product-detail-extensions.ts:
 * instrumentation.ts is bundled separately from route code.
 */
export interface QuestionSubmittedEvent {
  questionId: string;
  productId: string;
  productSlug: string;
  productName: string;
  text: string;
  askedByUserId: string;
  submittedAt: Date;
}

export interface QuestionPublishedEvent {
  questionId: string;
  productId: string;
  productSlug: string;
  productName: string;
  askedByUserId: string;
  publishedAt: Date;
}

export interface QaNotifier {
  onQuestionSubmitted(event: QuestionSubmittedEvent): Promise<void>;
  onQuestionPublished(event: QuestionPublishedEvent): Promise<void>;
}

const loggingNotifier: QaNotifier = {
  async onQuestionSubmitted(event) {
    console.info(
      `[qa-notify] question submitted ${event.questionId} on ${event.productSlug} — notify admin (STORY-032 not wired yet)`,
    );
  },
  async onQuestionPublished(event) {
    console.info(
      `[qa-notify] question published ${event.questionId} on ${event.productSlug} — notify customer ${event.askedByUserId} (STORY-032 not wired yet)`,
    );
  },
};

const globalForQa = globalThis as unknown as { __oristorQaNotifier?: { notifier: QaNotifier } };
const holder = (globalForQa.__oristorQaNotifier ??= { notifier: loggingNotifier });

export function registerQaNotifier(notifier: QaNotifier): void {
  holder.notifier = notifier;
}

export async function notifyQuestionSubmitted(event: QuestionSubmittedEvent): Promise<void> {
  try {
    await holder.notifier.onQuestionSubmitted(event);
  } catch (error) {
    console.error("[qa-notify] onQuestionSubmitted failed", error);
  }
}

export async function notifyQuestionPublished(event: QuestionPublishedEvent): Promise<void> {
  try {
    await holder.notifier.onQuestionPublished(event);
  } catch (error) {
    console.error("[qa-notify] onQuestionPublished failed", error);
  }
}

/** Test-only: restores the default logging notifier. */
export function resetQaNotifierForTesting(): void {
  holder.notifier = loggingNotifier;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/unit/qa-notifications.test.ts`
Expected: PASS, with no console output in the run (the tests spy and silence the console).

- [ ] **Step 6: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/services/qa.errors.ts src/services/qa-notifications.ts tests/unit/qa-notifications.test.ts
git commit -m "feat: add Q&A errors and notify-admin/notify-customer hooks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Question lifecycle service (`answerQuestion`, `changeQuestionStatus`)

**Files:**
- Create: `src/services/qa.service.ts`
- Test: `tests/unit/qa-lifecycle.test.ts`

**Interfaces:**
- Consumes: Task 3 repository; Task 4 errors and notify functions; `answerTextSchema` (Task 2); `findProductById` from `@/repositories/product.repository`.
- Produces: `canTransitionQuestion(from: QuestionStatus, to: QuestionStatus): boolean`; `answerQuestion(questionId: string, answerText: string, moderatorId?: string): Promise<Question>`; `changeQuestionStatus(questionId: string, nextStatus: QuestionStatus): Promise<Question>`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/qa-lifecycle.test.ts`:

```ts
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { QuestionStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createQuestion, findQuestionById } from "@/repositories/qa.repository";
import { registerQaNotifier, resetQaNotifierForTesting } from "@/services/qa-notifications";
import { InvalidQuestionInputError, InvalidQuestionTransitionError, QuestionNotFoundError } from "@/services/qa.errors";
import { answerQuestion, canTransitionQuestion, changeQuestionStatus } from "@/services/qa.service";

let sequence = 0;
const onQuestionSubmitted = vi.fn(async () => {});
const onQuestionPublished = vi.fn(async () => {});

async function makePendingQuestion() {
  sequence += 1;
  const product = await createProduct({ sku: `QA-LIFE-${sequence}`, slug: `qa-life-${sequence}`, name: "Chilli Powder 100g", status: "Published" });
  const user = await prisma.user.create({ data: { email: `qa-life-${sequence}@test.com` } });
  return createQuestion({ productId: product.id, userId: user.id, text: "Is it very hot?" });
}

beforeEach(() => {
  registerQaNotifier({ onQuestionSubmitted, onQuestionPublished });
});

afterEach(async () => {
  resetQaNotifierForTesting();
  vi.clearAllMocks();
  await prisma.question.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
});

const statuses: QuestionStatus[] = ["Pending", "Answered", "Approved", "Published", "Rejected"];
const allowed = new Set([
  "Pending>Answered",
  "Pending>Rejected",
  "Answered>Approved",
  "Answered>Rejected",
  "Approved>Published",
  "Approved>Rejected",
  "Published>Rejected",
]);

describe("canTransitionQuestion", () => {
  const pairs = statuses.flatMap((from) => statuses.map((to) => [from, to] as const));

  it.each(pairs)("%s -> %s matches the blueprint workflow", (from, to) => {
    expect(canTransitionQuestion(from, to)).toBe(allowed.has(`${from}>${to}`));
  });
});

describe("answerQuestion", () => {
  it("moves Pending to Answered and records the answer", async () => {
    const question = await makePendingQuestion();
    const staff = await prisma.user.create({ data: { email: "qa-staff@test.com", name: "Staff" } });

    const answered = await answerQuestion(question.id, "  Medium heat.  ", staff.id);

    expect(answered).toMatchObject({ status: "Answered", answerText: "Medium heat.", answeredById: staff.id });
    expect(answered.answeredAt).toBeInstanceOf(Date);
  });

  it("allows no moderator (dev tooling) — answeredById stays null", async () => {
    const question = await makePendingQuestion();

    expect((await answerQuestion(question.id, "Yes.")).answeredById).toBeNull();
  });

  it("rejects a blank answer", async () => {
    const question = await makePendingQuestion();

    await expect(answerQuestion(question.id, "   ")).rejects.toBeInstanceOf(InvalidQuestionInputError);
  });

  it("refuses a question that isn't Pending, and an unknown question", async () => {
    const question = await makePendingQuestion();
    await answerQuestion(question.id, "First answer.");

    await expect(answerQuestion(question.id, "Second answer.")).rejects.toBeInstanceOf(InvalidQuestionTransitionError);
    await expect(answerQuestion("missing", "Answer.")).rejects.toBeInstanceOf(QuestionNotFoundError);
  });
});

describe("changeQuestionStatus", () => {
  it("never accepts Answered — the answer path can't be bypassed", async () => {
    const question = await makePendingQuestion();

    await expect(changeQuestionStatus(question.id, "Answered")).rejects.toBeInstanceOf(InvalidQuestionTransitionError);
    expect((await findQuestionById(question.id))?.status).toBe("Pending");
  });

  it("rejects transitions outside the workflow", async () => {
    const question = await makePendingQuestion();

    await expect(changeQuestionStatus(question.id, "Published")).rejects.toBeInstanceOf(InvalidQuestionTransitionError);
    await expect(changeQuestionStatus("missing", "Rejected")).rejects.toBeInstanceOf(QuestionNotFoundError);
  });

  it("publishes, sets publishedAt and notifies the customer exactly once", async () => {
    const question = await makePendingQuestion();
    await answerQuestion(question.id, "Medium heat.");
    await changeQuestionStatus(question.id, "Approved");
    expect(onQuestionPublished).not.toHaveBeenCalled();

    const published = await changeQuestionStatus(question.id, "Published");

    expect(published.status).toBe("Published");
    expect(published.publishedAt).toBeInstanceOf(Date);
    expect(onQuestionPublished).toHaveBeenCalledOnce();
    expect(onQuestionPublished).toHaveBeenCalledWith({
      questionId: question.id,
      productId: question.productId,
      productSlug: expect.stringMatching(/^qa-life-/),
      productName: "Chilli Powder 100g",
      askedByUserId: question.userId,
      publishedAt: published.publishedAt,
    });
  });

  it("can take a published question down without notifying", async () => {
    const question = await makePendingQuestion();
    await answerQuestion(question.id, "Medium heat.");
    await changeQuestionStatus(question.id, "Approved");
    await changeQuestionStatus(question.id, "Published");
    onQuestionPublished.mockClear();

    const rejected = await changeQuestionStatus(question.id, "Rejected");

    expect(rejected.status).toBe("Rejected");
    expect(onQuestionPublished).not.toHaveBeenCalled();
    expect(onQuestionSubmitted).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/qa-lifecycle.test.ts`
Expected: FAIL, `Failed to resolve import "@/services/qa.service"`.

- [ ] **Step 3: Create `src/services/qa.service.ts`**

```ts
import type { QuestionStatus } from "@/generated/prisma/client";
import { findProductById } from "@/repositories/product.repository";
import * as qaRepository from "@/repositories/qa.repository";
import type { QuestionStatusUpdate } from "@/repositories/qa.repository";
import { notifyQuestionPublished } from "@/services/qa-notifications";
import { InvalidQuestionInputError, InvalidQuestionTransitionError, QuestionNotFoundError } from "@/services/qa.errors";
import { answerTextSchema } from "@/validation/question.schema";

// ---------------------------------------------------------------------------
// Status lifecycle (blueprint Section 7: submit → answer → approve → publish).
// answerQuestion() and changeQuestionStatus() are the only ways a status
// changes; the STORY-046 moderation console calls them.
// ---------------------------------------------------------------------------

const allowedTransitions: Record<QuestionStatus, readonly QuestionStatus[]> = {
  Pending: ["Answered", "Rejected"],
  Answered: ["Approved", "Rejected"],
  Approved: ["Published", "Rejected"],
  Published: ["Rejected"],
  Rejected: [],
};

export function canTransitionQuestion(from: QuestionStatus, to: QuestionStatus): boolean {
  return allowedTransitions[from].includes(to);
}

/**
 * Pending → Answered, recording the staff answer. `moderatorId` is optional
 * only so dev tooling (seed, qa:publish) can answer without a staff account;
 * STORY-046 always passes it.
 */
export async function answerQuestion(questionId: string, answerText: string, moderatorId?: string) {
  const parsed = answerTextSchema.safeParse(answerText);
  if (!parsed.success) throw new InvalidQuestionInputError(parsed.error.issues[0]?.message ?? "Invalid answer");

  const question = await qaRepository.findQuestionById(questionId);
  if (!question) throw new QuestionNotFoundError();
  if (question.status !== "Pending") throw new InvalidQuestionTransitionError(question.status, "Answered");

  const answered = await qaRepository.answerPendingQuestion(question.id, {
    answerText: parsed.data,
    answeredById: moderatorId ?? null,
    answeredAt: new Date(),
  });
  // Null: it left Pending between the read and the conditional write.
  if (!answered) throw new InvalidQuestionTransitionError(question.status, "Answered");
  return answered;
}

/** Approve, publish or reject. Answering goes through answerQuestion() only. */
export async function changeQuestionStatus(questionId: string, nextStatus: QuestionStatus) {
  const question = await qaRepository.findQuestionById(questionId);
  if (!question) throw new QuestionNotFoundError();
  if (nextStatus === "Answered" || !canTransitionQuestion(question.status, nextStatus)) {
    throw new InvalidQuestionTransitionError(question.status, nextStatus);
  }

  const data: QuestionStatusUpdate = { status: nextStatus };
  if (nextStatus === "Published") data.publishedAt = new Date();

  const updated = await qaRepository.updateQuestionStatus(question.id, question.status, data);
  if (!updated) throw new InvalidQuestionTransitionError(question.status, nextStatus);

  if (updated.status === "Published") {
    const product = await findProductById(updated.productId);
    await notifyQuestionPublished({
      questionId: updated.id,
      productId: updated.productId,
      productSlug: product?.slug ?? "",
      productName: product?.name ?? "",
      askedByUserId: updated.userId,
      publishedAt: updated.publishedAt ?? new Date(),
    });
  }
  return updated;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/qa-lifecycle.test.ts`
Expected: PASS (25 transition cases + the named tests), no console output.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/services/qa.service.ts tests/unit/qa-lifecycle.test.ts
git commit -m "feat: add question lifecycle with answerQuestion and changeQuestionStatus" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Customer Q&A actions, listing and the PDP provider

**Files:**
- Modify: `src/services/qa.service.ts` (imports; append sections)
- Modify: `src/services/product-detail-extensions.ts` (the `QaPreview` interface)
- Modify: `src/instrumentation.ts`
- Modify: `tests/unit/product-detail-extensions.test.ts` (the QA fixture, around line 47)
- Test: `tests/unit/qa-service.test.ts`

**Interfaces:**
- Consumes: Tasks 2–5; `findProductBySlug` from `@/repositories/product.repository`; `registerQaSummaryProvider`, `QaSummary` from `@/services/product-detail-extensions`.
- Produces:
  - `submitQuestion(userId, productSlug, input: QuestionInput): Promise<OwnQuestion>`
  - `splitSearchWords(q?: string): string[]`
  - `listPublishedQuestionsForProduct(productId, query: QuestionListQuery): Promise<QuestionPage>`
  - `listPublishedQuestions(productSlug, query): Promise<QuestionPage>`
  - `listMyOpenQuestions(userId, productSlug): Promise<OwnQuestion[]>`
  - `getQaSummaryForProduct(productId): Promise<QaSummary | null>`
  - `registerQaProviders(): void`
  - `QaPreview = PublicQuestion`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/qa-service.test.ts`:

```ts
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db";
import { createStandardPrice } from "@/repositories/pricing.repository";
import { createProduct } from "@/repositories/product.repository";
import { resetProductDetailExtensionsForTesting } from "@/services/product-detail-extensions";
import { getProductDetail } from "@/services/product.service";
import { registerQaNotifier, resetQaNotifierForTesting } from "@/services/qa-notifications";
import { InvalidQuestionInputError, QaProductNotFoundError } from "@/services/qa.errors";
import {
  answerQuestion,
  changeQuestionStatus,
  getQaSummaryForProduct,
  listMyOpenQuestions,
  listPublishedQuestions,
  registerQaProviders,
  splitSearchWords,
  submitQuestion,
} from "@/services/qa.service";

let sequence = 0;
const onQuestionSubmitted = vi.fn(async () => {});
const onQuestionPublished = vi.fn(async () => {});
const defaultQuery = { page: 1, pageSize: 10 };

async function makeProduct(status: "Published" | "Draft" = "Published") {
  sequence += 1;
  const product = await createProduct({ sku: `QA-SVC-${sequence}`, slug: `qa-svc-${sequence}`, name: "Turmeric Powder", status });
  await createStandardPrice({ product: { connect: { id: product.id } }, price: "400.00" });
  return product;
}

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `qa-svc-${sequence}@test.com` } });
}

async function publishedQuestion(productSlug: string, text: string, answer: string) {
  const question = await submitQuestion((await makeUser()).id, productSlug, { text });
  await answerQuestion(question.id, answer);
  await changeQuestionStatus(question.id, "Approved");
  await changeQuestionStatus(question.id, "Published");
  return question;
}

beforeEach(() => {
  registerQaNotifier({ onQuestionSubmitted, onQuestionPublished });
});

afterEach(async () => {
  resetQaNotifierForTesting();
  resetProductDetailExtensionsForTesting();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  await prisma.question.deleteMany();
  await prisma.standardPrice.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
});

describe("submitQuestion", () => {
  it("creates a Pending question and notifies admin once with the event", async () => {
    const product = await makeProduct();
    const user = await makeUser();

    const question = await submitQuestion(user.id, product.slug, { text: "  Is it organic?  Asking for my mum. " });

    expect(question).toMatchObject({ text: "Is it organic?  Asking for my mum.", status: "Pending" });
    expect(onQuestionSubmitted).toHaveBeenCalledOnce();
    expect(onQuestionSubmitted).toHaveBeenCalledWith({
      questionId: question.id,
      productId: product.id,
      productSlug: product.slug,
      productName: "Turmeric Powder",
      text: "Is it organic?  Asking for my mum.",
      askedByUserId: user.id,
      submittedAt: expect.any(Date),
    });
  });

  it("allows several open questions from the same customer", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    await submitQuestion(user.id, product.slug, { text: "First question here?" });

    await expect(submitQuestion(user.id, product.slug, { text: "Second question here?" })).resolves.toMatchObject({
      status: "Pending",
    });
  });

  it("rejects an unknown or unpublished product and invalid text, without notifying", async () => {
    const draft = await makeProduct("Draft");
    const product = await makeProduct();
    const user = await makeUser();

    await expect(submitQuestion(user.id, draft.slug, { text: "Is it organic?" })).rejects.toBeInstanceOf(QaProductNotFoundError);
    await expect(submitQuestion(user.id, "nope", { text: "Is it organic?" })).rejects.toBeInstanceOf(QaProductNotFoundError);
    await expect(submitQuestion(user.id, product.slug, { text: "Hot?" })).rejects.toBeInstanceOf(InvalidQuestionInputError);
    expect(onQuestionSubmitted).not.toHaveBeenCalled();
  });

  it("still succeeds when the notifier throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    registerQaNotifier({
      onQuestionSubmitted: async () => {
        throw new Error("down");
      },
      onQuestionPublished: async () => {},
    });
    const product = await makeProduct();

    await expect(submitQuestion((await makeUser()).id, product.slug, { text: "Does it contain salt?" })).resolves.toMatchObject({
      status: "Pending",
    });
  });
});

describe("splitSearchWords", () => {
  it("splits on whitespace and drops blanks", () => {
    expect(splitSearchWords("  storage   tips ")).toEqual(["storage", "tips"]);
    expect(splitSearchWords(undefined)).toEqual([]);
    expect(splitSearchWords("   ")).toEqual([]);
  });
});

describe("listPublishedQuestions", () => {
  it("returns only Published Q&A as public DTOs with pagination metadata", async () => {
    const product = await makeProduct();
    await publishedQuestion(product.slug, "How should I store it?", "In an airtight jar.");
    await submitQuestion((await makeUser()).id, product.slug, { text: "Still pending question?" });

    const page = await listPublishedQuestions(product.slug, defaultQuery);

    expect(page).toMatchObject({ total: 1, page: 1, pageSize: 10 });
    expect(page.items[0]).toEqual({
      id: expect.any(String),
      question: "How should I store it?",
      answer: "In an airtight jar.",
      publishedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });

  it("filters by every word of q across question and answer", async () => {
    const product = await makeProduct();
    await publishedQuestion(product.slug, "How should I store it?", "In an airtight jar.");
    await publishedQuestion(product.slug, "Is it very hot?", "Medium heat.");

    expect((await listPublishedQuestions(product.slug, { ...defaultQuery, q: "STORE airtight" })).total).toBe(1);
    expect((await listPublishedQuestions(product.slug, { ...defaultQuery, q: "store heat" })).total).toBe(0);
    expect((await listPublishedQuestions(product.slug, defaultQuery)).total).toBe(2);
  });

  it("rejects an unpublished product", async () => {
    const draft = await makeProduct("Draft");

    await expect(listPublishedQuestions(draft.slug, defaultQuery)).rejects.toBeInstanceOf(QaProductNotFoundError);
  });
});

describe("listMyOpenQuestions", () => {
  it("returns the customer's own open questions only", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    const open = await submitQuestion(user.id, product.slug, { text: "My open question?" });
    const toReject = await submitQuestion(user.id, product.slug, { text: "My rejected question?" });
    await changeQuestionStatus(toReject.id, "Rejected");
    await submitQuestion((await makeUser()).id, product.slug, { text: "Someone else's question?" });

    const mine = await listMyOpenQuestions(user.id, product.slug);

    expect(mine).toEqual([{ id: open.id, text: "My open question?", status: "Pending", createdAt: expect.any(String) }]);
  });
});

describe("PDP provider", () => {
  it("returns null without Published Q&A, else the first page and total", async () => {
    const product = await makeProduct();
    expect(await getQaSummaryForProduct(product.id)).toBeNull();

    await publishedQuestion(product.slug, "How should I store it?", "In an airtight jar.");
    const summary = await getQaSummaryForProduct(product.id);

    expect(summary?.totalCount).toBe(1);
    expect(summary?.previewItems[0]?.question).toBe("How should I store it?");
  });

  it("registerQaProviders makes getProductDetail include real Q&A", async () => {
    const product = await makeProduct();
    await publishedQuestion(product.slug, "How should I store it?", "In an airtight jar.");

    registerQaProviders();

    expect((await getProductDetail(product.slug))?.qaSummary?.totalCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/qa-service.test.ts`
Expected: FAIL. `submitQuestion` (and the other new functions) are not exported.

- [ ] **Step 3: Change `QaPreview` in `src/services/product-detail-extensions.ts`**

Replace the existing `QaPreview` interface (the one with `id`, `question`, `answer`, `createdAt: Date`) with:

```ts
/** A Published question with its answer. Same shape the questions API returns. */
export type QaPreview = PublicQuestion;
```

and extend the existing type import at the top of the file so it reads:

```ts
import type { PublicQuestion } from "@/types/question";
import type { PublicReview, RatingHistogram } from "@/types/review";
```

Leave `QaSummary` (`previewItems: QaPreview[]; totalCount: number`) and everything else unchanged.

- [ ] **Step 4: Update the QA fixture in `tests/unit/product-detail-extensions.test.ts`**

Replace

```ts
      previewItems: [{ id: "q1", question: "Is it spicy?", answer: "Mildly", createdAt: new Date() }],
```

with

```ts
      previewItems: [{ id: "q1", question: "Is it spicy?", answer: "Mildly", publishedAt: "2026-09-01T00:00:00.000Z" }],
```

- [ ] **Step 5: Extend `src/services/qa.service.ts`**

Replace the import block at the top with:

```ts
import type { Question, QuestionStatus } from "@/generated/prisma/client";
import { findProductById, findProductBySlug } from "@/repositories/product.repository";
import * as qaRepository from "@/repositories/qa.repository";
import type { QuestionStatusUpdate } from "@/repositories/qa.repository";
import { registerQaSummaryProvider, type QaSummary } from "@/services/product-detail-extensions";
import { notifyQuestionPublished, notifyQuestionSubmitted } from "@/services/qa-notifications";
import {
  InvalidQuestionInputError,
  InvalidQuestionTransitionError,
  QaProductNotFoundError,
  QuestionNotFoundError,
} from "@/services/qa.errors";
import { QUESTION_PAGE_SIZE, type OwnQuestion, type PublicQuestion, type QuestionPage } from "@/types/question";
import {
  answerTextSchema,
  questionInputSchema,
  type QuestionInput,
  type QuestionListQuery,
} from "@/validation/question.schema";
```

Append at the end of the file:

```ts
// ---------------------------------------------------------------------------
// Customer actions and public listing
// ---------------------------------------------------------------------------

function toOwnQuestion(question: Question): OwnQuestion {
  return { id: question.id, text: question.text, status: question.status, createdAt: question.createdAt.toISOString() };
}

function toPublicQuestion(question: Question): PublicQuestion {
  return {
    id: question.id,
    question: question.text,
    answer: question.answerText ?? "",
    publishedAt: (question.publishedAt ?? question.updatedAt).toISOString(),
  };
}

async function requirePublishedProduct(productSlug: string) {
  const product = await findProductBySlug(productSlug);
  if (!product || product.status !== "Published") throw new QaProductNotFoundError();
  return product;
}

export async function submitQuestion(userId: string, productSlug: string, input: QuestionInput): Promise<OwnQuestion> {
  const product = await requirePublishedProduct(productSlug);
  // Routes validate with the same schema; this protects non-API callers too.
  const parsed = questionInputSchema.safeParse(input);
  if (!parsed.success) throw new InvalidQuestionInputError(parsed.error.issues[0]?.message ?? "Invalid question");

  const question = await qaRepository.createQuestion({ productId: product.id, userId, text: parsed.data.text });
  await notifyQuestionSubmitted({
    questionId: question.id,
    productId: product.id,
    productSlug: product.slug,
    productName: product.name,
    text: question.text,
    askedByUserId: userId,
    submittedAt: question.createdAt,
  });
  return toOwnQuestion(question);
}

export function splitSearchWords(q?: string): string[] {
  return q ? q.trim().split(/\s+/).filter(Boolean) : [];
}

export async function listPublishedQuestionsForProduct(productId: string, query: QuestionListQuery): Promise<QuestionPage> {
  const { items, total } = await qaRepository.listPublishedQuestions(productId, {
    words: splitSearchWords(query.q),
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  });
  return { items: items.map(toPublicQuestion), total, page: query.page, pageSize: query.pageSize };
}

export async function listPublishedQuestions(productSlug: string, query: QuestionListQuery): Promise<QuestionPage> {
  const product = await requirePublishedProduct(productSlug);
  return listPublishedQuestionsForProduct(product.id, query);
}

export async function listMyOpenQuestions(userId: string, productSlug: string): Promise<OwnQuestion[]> {
  const product = await requirePublishedProduct(productSlug);
  const questions = await qaRepository.listOpenQuestionsByUser(product.id, userId);
  return questions.map(toOwnQuestion);
}

// ---------------------------------------------------------------------------
// PDP integration (STORY-011 extension point)
// ---------------------------------------------------------------------------

export async function getQaSummaryForProduct(productId: string): Promise<QaSummary | null> {
  const firstPage = await listPublishedQuestionsForProduct(productId, { page: 1, pageSize: QUESTION_PAGE_SIZE });
  if (firstPage.total === 0) return null;
  return { previewItems: firstPage.items, totalCount: firstPage.total };
}

/** Called once at server startup from src/instrumentation.ts. */
export function registerQaProviders(): void {
  registerQaSummaryProvider(getQaSummaryForProduct);
}
```

The existing lifecycle code (`allowedTransitions`, `canTransitionQuestion`, `answerQuestion`, `changeQuestionStatus`) stays unchanged; the new import block still covers everything it uses.

- [ ] **Step 6: Register the provider at startup**

Replace the body of `register()` in `src/instrumentation.ts` so the file reads:

```ts
/**
 * Next.js calls register() once when the server starts. It runs in both the
 * Node.js and Edge runtimes; Prisma only loads on Node.js, so the services are
 * imported only there.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const [{ registerReviewProviders }, { registerQaProviders }] = await Promise.all([
      import("@/services/review.service"),
      import("@/services/qa.service"),
    ]);
    registerReviewProviders();
    registerQaProviders();
  }
}
```

- [ ] **Step 7: Run the tests, one file per command**

```bash
npx vitest run tests/unit/qa-service.test.ts
npx vitest run tests/unit/qa-lifecycle.test.ts
npx vitest run tests/unit/product-detail-extensions.test.ts
npx vitest run tests/unit/product-detail-service.test.ts
```

Expected: all PASS, no console output.

- [ ] **Step 8: Typecheck, lint, commit**

`src/app/(storefront)/products/[slug]/page.tsx` still compiles: it reads only `id`, `question` and `answer` from `previewItems`.

```bash
npx tsc --noEmit && npm run lint
git add src/services/qa.service.ts src/services/product-detail-extensions.ts src/instrumentation.ts tests/unit/qa-service.test.ts tests/unit/product-detail-extensions.test.ts
git commit -m "feat: add question submission, listing and the PDP Q&A provider" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Q&A API routes (and shared response helpers)

**Files:**
- Create: `src/lib/api/responses.ts`
- Modify: `src/lib/api/review-responses.ts` (remove the two moved helpers)
- Modify: `src/app/api/products/[slug]/reviews/route.ts`, `.../reviews/mine/route.ts`, `.../reviews/[reviewId]/route.ts` (import the moved helpers from `@/lib/api/responses`)
- Create: `src/lib/api/qa-responses.ts`
- Create: `src/app/api/products/[slug]/questions/route.ts`
- Create: `src/app/api/products/[slug]/questions/mine/route.ts`
- Test: `tests/unit/qa-routes.test.ts`

**Interfaces:**
- Consumes: Task 6 service functions; `questionInputSchema`, `questionListQuerySchema`; `QaServiceError`, `QaErrorCode`.
- Produces:
  - `unauthorizedResponse()`, `validationErrorResponse(error)` in `src/lib/api/responses.ts`
  - `qaErrorResponse(error)`
  - `GET /questions` → 200 `QuestionPage`
  - `POST /questions` → 201 `{ question: OwnQuestion }`
  - `GET /questions/mine` → 200 `{ questions: OwnQuestion[] }`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/qa-routes.test.ts`:

```ts
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Session } from "next-auth";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { registerQaNotifier, resetQaNotifierForTesting } from "@/services/qa-notifications";
import { answerQuestion, changeQuestionStatus, submitQuestion } from "@/services/qa.service";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

const { auth } = await import("@/lib/auth");
const listRoute = await import("@/app/api/products/[slug]/questions/route");
const mineRoute = await import("@/app/api/products/[slug]/questions/mine/route");
const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;

let sequence = 0;

function sessionFor(userId: string): Session {
  return { user: { id: userId, name: null, email: null, image: null }, expires: "2099-01-01T00:00:00.000Z" };
}

function slugParams(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

function postRequest(body: unknown) {
  return new Request("http://localhost/x", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
}

async function makeProduct(status: "Published" | "Draft" = "Published") {
  sequence += 1;
  return createProduct({ sku: `QA-ROUTE-${sequence}`, slug: `qa-route-${sequence}`, name: "Cinnamon", status });
}

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `qa-route-${sequence}@test.com` } });
}

beforeEach(() => {
  registerQaNotifier({ onQuestionSubmitted: async () => {}, onQuestionPublished: async () => {} });
});

afterEach(async () => {
  resetQaNotifierForTesting();
  vi.clearAllMocks();
  await prisma.question.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
});

describe("GET /api/products/[slug]/questions", () => {
  it("lists Published Q&A only and applies q", async () => {
    const product = await makeProduct();
    const published = await submitQuestion((await makeUser()).id, product.slug, { text: "How should I store it?" });
    await answerQuestion(published.id, "Airtight jar.");
    await changeQuestionStatus(published.id, "Approved");
    await changeQuestionStatus(published.id, "Published");
    await submitQuestion((await makeUser()).id, product.slug, { text: "A pending question here?" });

    const all = await listRoute.GET(new Request(`http://localhost/api/products/${product.slug}/questions`), slugParams(product.slug));
    const filtered = await listRoute.GET(
      new Request(`http://localhost/api/products/${product.slug}/questions?q=nothing-matches`),
      slugParams(product.slug),
    );

    expect(all.status).toBe(200);
    expect(await all.json()).toMatchObject({ total: 1, page: 1, pageSize: 10, items: [{ id: published.id }] });
    expect((await filtered.json()).total).toBe(0);
  });

  it("returns 400 with field errors for an invalid query, 404 for an unpublished product", async () => {
    const product = await makeProduct();
    const draft = await makeProduct("Draft");

    const invalid = await listRoute.GET(new Request(`http://localhost/x?pageSize=99`), slugParams(product.slug));
    const missing = await listRoute.GET(new Request("http://localhost/x"), slugParams(draft.slug));

    expect(invalid.status).toBe(400);
    expect((await invalid.json()).fieldErrors.pageSize).toBeDefined();
    expect(missing.status).toBe(404);
  });
});

describe("POST /api/products/[slug]/questions", () => {
  it("returns 401 when not signed in", async () => {
    mockAuth.mockResolvedValue(null);
    const product = await makeProduct();

    expect((await listRoute.POST(postRequest({ text: "Is it organic?" }), slugParams(product.slug))).status).toBe(401);
  });

  it("returns 400 with field errors, 404 for an unknown product, 201 on success", async () => {
    const product = await makeProduct();
    mockAuth.mockResolvedValue(sessionFor((await makeUser()).id));

    const invalid = await listRoute.POST(postRequest({ text: "Hot?" }), slugParams(product.slug));
    const missing = await listRoute.POST(postRequest({ text: "Is it organic?" }), slugParams("nope"));
    const created = await listRoute.POST(postRequest({ text: "Is it organic?" }), slugParams(product.slug));

    expect(invalid.status).toBe(400);
    expect((await invalid.json()).fieldErrors.text).toEqual(["Question must be at least 10 characters"]);
    expect(missing.status).toBe(404);
    expect(created.status).toBe(201);
    expect((await created.json()).question).toMatchObject({ text: "Is it organic?", status: "Pending" });
  });
});

describe("GET /api/products/[slug]/questions/mine", () => {
  it("returns 401, 404 for an unknown product, then the customer's open questions", async () => {
    const product = await makeProduct();
    const user = await makeUser();

    mockAuth.mockResolvedValue(null);
    expect((await mineRoute.GET(new Request("http://localhost/x"), slugParams(product.slug))).status).toBe(401);

    mockAuth.mockResolvedValue(sessionFor(user.id));
    expect((await mineRoute.GET(new Request("http://localhost/x"), slugParams("nope"))).status).toBe(404);

    const question = await submitQuestion(user.id, product.slug, { text: "My question is this?" });
    const response = await mineRoute.GET(new Request("http://localhost/x"), slugParams(product.slug));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ questions: [question] });
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/qa-routes.test.ts`
Expected: FAIL, `Failed to resolve import "@/app/api/products/[slug]/questions/route"`.

- [ ] **Step 3: Move the shared helpers into `src/lib/api/responses.ts`**

Create `src/lib/api/responses.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";

/** Shared by the reviews and questions route handlers. */
export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function validationErrorResponse(error: z.ZodError) {
  return NextResponse.json(
    { error: error.issues[0]?.message ?? "Invalid input", fieldErrors: z.flattenError(error).fieldErrors },
    { status: 400 },
  );
}
```

In `src/lib/api/review-responses.ts`, delete the `unauthorizedResponse` and `validationErrorResponse` functions and the now-unused `import { z } from "zod";` line. Keep `statusByCode` and `reviewErrorResponse`.

In each of the three review route files, change the import from `@/lib/api/review-responses` so the moved helpers come from the new module. For example, in `src/app/api/products/[slug]/reviews/route.ts`:

```ts
import { reviewErrorResponse } from "@/lib/api/review-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
```

Do the same in `reviews/mine/route.ts`, importing only what that file uses (`reviewErrorResponse`, `unauthorizedResponse`), and in `reviews/[reviewId]/route.ts` (all three).

- [ ] **Step 4: Create `src/lib/api/qa-responses.ts`**

```ts
import { NextResponse } from "next/server";

import { QaServiceError, type QaErrorCode } from "@/services/qa.errors";

const statusByCode: Record<QaErrorCode, number> = {
  invalid_input: 400,
  product_not_found: 404,
  question_not_found: 404,
  invalid_transition: 409,
};

/** Maps a Q&A service error to its HTTP response; anything else is rethrown (500). */
export function qaErrorResponse(error: unknown) {
  if (error instanceof QaServiceError) {
    return NextResponse.json({ error: error.message }, { status: statusByCode[error.code] });
  }
  throw error;
}
```

- [ ] **Step 5: Create `src/app/api/products/[slug]/questions/route.ts`**

```ts
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { qaErrorResponse } from "@/lib/api/qa-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { listPublishedQuestions, submitQuestion } from "@/services/qa.service";
import { questionInputSchema, questionListQuerySchema } from "@/validation/question.schema";

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const parsed = questionListQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await listPublishedQuestions(slug, parsed.data), { status: 200 });
  } catch (error) {
    return qaErrorResponse(error);
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { slug } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = questionInputSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const question = await submitQuestion(session.user.id, slug, parsed.data);
    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    return qaErrorResponse(error);
  }
}
```

- [ ] **Step 6: Create `src/app/api/products/[slug]/questions/mine/route.ts`**

```ts
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { qaErrorResponse } from "@/lib/api/qa-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { listMyOpenQuestions } from "@/services/qa.service";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { slug } = await params;
  try {
    return NextResponse.json({ questions: await listMyOpenQuestions(session.user.id, slug) }, { status: 200 });
  } catch (error) {
    return qaErrorResponse(error);
  }
}
```

- [ ] **Step 7: Run the tests, one file per command**

```bash
npx vitest run tests/unit/qa-routes.test.ts
npx vitest run tests/unit/review-routes.test.ts
```

Expected: both PASS. `review-routes` proves the helper move broke nothing.

- [ ] **Step 8: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/lib/api/responses.ts src/lib/api/review-responses.ts src/lib/api/qa-responses.ts "src/app/api/products/[slug]/reviews" "src/app/api/products/[slug]/questions" tests/unit/qa-routes.test.ts
git commit -m "feat: add product Q&A API routes; share route response helpers" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Q&A list and search on the PDP

**Files:**
- Create: `src/lib/api/api-error.ts`
- Create: `src/lib/api/question-client.ts`
- Create: `src/lib/format-date.ts`
- Modify: `src/components/storefront/product/reviews/review-list.tsx` (use the shared date formatter)
- Create: `src/components/storefront/product/questions/qa-search.tsx`
- Create: `src/components/storefront/product/questions/qa-list.tsx`
- Create: `src/components/storefront/product/questions/questions-section.tsx`
- Modify: `src/app/(storefront)/products/[slug]/page.tsx` (replace the "Questions & Answers" block)
- Test: `tests/unit/question-client.test.ts`, `tests/unit/questions-section.test.tsx`

**Interfaces:**
- Consumes: the API from Task 7; types from Task 2; `QaSummary` (type-only) from `@/services/product-detail-extensions`; `useDebouncedValue(value, delayMs)` from `@/hooks/use-debounced-value`.
- Produces:
  - `ApiError<F extends string>` (`status`, `fieldErrors: Partial<Record<F, string[]>>`) and `readApiError<F>(response)`
  - `fetchQuestionPage(slug, query: QuestionPageQuery): Promise<QuestionPage>`
  - `fetchMyQuestions(slug): Promise<OwnQuestion[]>`
  - `postQuestion(slug, input: QuestionInput): Promise<OwnQuestion>`
  - `QuestionApiError = ApiError<"text">`
  - `formatDisplayDate(iso: string): string`
  - `QuestionsSection({ productSlug, summary })`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/question-client.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/api-error";
import { fetchMyQuestions, fetchQuestionPage, postQuestion } from "@/lib/api/question-client";

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  fetchMock.mockReset();
});

describe("question-client", () => {
  it("builds the list URL with q only when set", async () => {
    fetchMock.mockImplementation(async () => json({ items: [], total: 0, page: 1, pageSize: 10 }));

    await fetchQuestionPage("chilli powder", { page: 2, pageSize: 10 });
    await fetchQuestionPage("chilli", { page: 1, pageSize: 10, q: "store it" });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/products/chilli%20powder/questions?page=2&pageSize=10");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/products/chilli/questions?page=1&pageSize=10&q=store+it");
  });

  it("reads the customer's open questions", async () => {
    fetchMock.mockResolvedValue(json({ questions: [] }));

    expect(await fetchMyQuestions("chilli")).toEqual([]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/products/chilli/questions/mine");
  });

  it("posts a question and throws ApiError with field errors on 400", async () => {
    fetchMock.mockResolvedValue(json({ error: "Too short", fieldErrors: { text: ["Too short"] } }, 400));

    const error = await postQuestion("chilli", { text: "Hot?" }).catch((caught: unknown) => caught);

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, fieldErrors: { text: ["Too short"] } });
  });
});
```

Create `tests/unit/questions-section.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { QuestionsSection } from "@/components/storefront/product/questions/questions-section";
import type { QaSummary } from "@/services/product-detail-extensions";
import type { PublicQuestion } from "@/types/question";

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

function qa(id: string, question: string, answer = "An answer."): PublicQuestion {
  return { id, question, answer, publishedAt: "2026-09-01T00:00:00.000Z" };
}

const summary: QaSummary = {
  totalCount: 2,
  previewItems: [qa("q1", "How should I store it?", "In an airtight jar."), qa("q2", "Is it very hot?", "Medium heat.")],
};

function renderSection(value: QaSummary | null = summary) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <QuestionsSection productSlug="chilli" summary={value} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  fetchMock.mockReset();
});

describe("QuestionsSection", () => {
  it("renders the server-provided first page without fetching", () => {
    renderSection();

    expect(screen.getByRole("heading", { level: 2, name: "Questions & Answers" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "How should I store it?" })).toBeInTheDocument();
    expect(screen.getByText("In an airtight jar.")).toBeInTheDocument();
    expect(screen.getByText("Showing 1–2 of 2 questions")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the empty state when there are no questions", () => {
    renderSection(null);

    expect(screen.getByText("No questions yet. Be the first to ask.")).toBeInTheDocument();
  });

  it("searches after typing and shows a no-match message", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 10 }), { status: 200 }));
    renderSection();

    await userEvent.type(screen.getByLabelText("Search questions about this product"), "delivery");

    expect(await screen.findByText("No questions match “delivery”. Ask it below.")).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock.mock.calls.at(-1)?.[0]).toBe("/api/products/chilli/questions?page=1&pageSize=10&q=delivery"),
    );
  });

  it("pages forward with Next", async () => {
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify({ items: [qa("q11", "Page two question?")], total: 12, page: 2, pageSize: 10 }), { status: 200 }),
    );
    renderSection({ ...summary, totalCount: 12 });

    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByRole("heading", { name: "Page two question?" })).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/products/chilli/questions?page=2&pageSize=10");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

```bash
npx vitest run tests/unit/question-client.test.ts
npx vitest run tests/unit/questions-section.test.tsx
```

Expected: FAIL (unresolved imports).

- [ ] **Step 3: Create `src/lib/api/api-error.ts`**

```ts
/**
 * Error thrown by browser API clients on a non-2xx response, carrying the
 * HTTP status and any per-field validation errors from the server's
 * `{ error, fieldErrors? }` body. `F` is the form's field-name union.
 */
export class ApiError<F extends string = string> extends Error {
  readonly status: number;
  readonly fieldErrors: Partial<Record<F, string[]>>;

  constructor(message: string, status: number, fieldErrors: Partial<Record<F, string[]>> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

interface ErrorBody {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

export async function readApiError<F extends string>(response: Response): Promise<ApiError<F>> {
  const body = (await response.json().catch(() => null)) as ErrorBody | null;
  return new ApiError<F>(
    body?.error ?? `Request failed (${response.status})`,
    response.status,
    (body?.fieldErrors ?? {}) as Partial<Record<F, string[]>>,
  );
}
```

- [ ] **Step 4: Create `src/lib/api/question-client.ts`**

```ts
import { readApiError, type ApiError } from "@/lib/api/api-error";
import type { OwnQuestion, QuestionPage, QuestionPageQuery } from "@/types/question";
import type { QuestionInput } from "@/validation/question.schema";

/** Browser-side wrapper around the product questions API (STORY-016). */
export type QuestionApiError = ApiError<keyof QuestionInput>;

function questionsUrl(productSlug: string): string {
  return `/api/products/${encodeURIComponent(productSlug)}/questions`;
}

export async function fetchQuestionPage(productSlug: string, query: QuestionPageQuery): Promise<QuestionPage> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });
  if (query.q) params.set("q", query.q);
  const response = await fetch(`${questionsUrl(productSlug)}?${params.toString()}`);
  if (!response.ok) throw await readApiError<keyof QuestionInput>(response);
  return (await response.json()) as QuestionPage;
}

export async function fetchMyQuestions(productSlug: string): Promise<OwnQuestion[]> {
  const response = await fetch(`${questionsUrl(productSlug)}/mine`);
  if (!response.ok) throw await readApiError<keyof QuestionInput>(response);
  return ((await response.json()) as { questions: OwnQuestion[] }).questions;
}

export async function postQuestion(productSlug: string, input: QuestionInput): Promise<OwnQuestion> {
  const response = await fetch(questionsUrl(productSlug), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await readApiError<keyof QuestionInput>(response);
  return ((await response.json()) as { question: OwnQuestion }).question;
}
```

- [ ] **Step 5: Create `src/lib/format-date.ts` and use it in reviews**

```ts
// Fixed locale and time zone, so the server render and the browser hydrate
// to the same string.
const displayDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Colombo",
});

/** "1 Sept 2026" style date for an ISO 8601 string. */
export function formatDisplayDate(iso: string): string {
  return displayDateFormatter.format(new Date(iso));
}
```

In `src/components/storefront/product/reviews/review-list.tsx`:
- delete the module-level `dateFormatter` constant and its comment;
- add `import { formatDisplayDate } from "@/lib/format-date";`;
- replace `{dateFormatter.format(new Date(review.publishedAt))}` with `{formatDisplayDate(review.publishedAt)}`.

- [ ] **Step 6: Create `src/components/storefront/product/questions/qa-search.tsx`**

```tsx
"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface QaSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function QaSearch({ value, onChange }: QaSearchProps) {
  return (
    <div className="flex max-w-md flex-col gap-1">
      <Label htmlFor="qa-search">Search questions about this product</Label>
      <Input
        id="qa-search"
        type="search"
        maxLength={100}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
```

- [ ] **Step 7: Create `src/components/storefront/product/questions/qa-list.tsx`**

```tsx
"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { fetchQuestionPage } from "@/lib/api/question-client";
import { formatDisplayDate } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import type { QuestionPage, QuestionPageQuery } from "@/types/question";

interface QaListProps {
  productSlug: string;
  /** The server-rendered first page (no search). */
  initialPage: QuestionPage;
  query: QuestionPageQuery;
  onPageChange: (page: number) => void;
}

export function QaList({ productSlug, initialPage, query, onPageChange }: QaListProps) {
  const isInitialQuery = query.page === 1 && query.q === undefined;
  const { data, isError, isFetching } = useQuery({
    queryKey: ["questions", productSlug, query],
    queryFn: () => fetchQuestionPage(productSlug, query),
    initialData: isInitialQuery ? initialPage : undefined,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const page = data ?? initialPage;

  const from = page.total === 0 ? 0 : (page.page - 1) * page.pageSize + 1;
  const to = Math.min(page.page * page.pageSize, page.total);
  const lastPage = Math.max(1, Math.ceil(page.total / page.pageSize));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-small text-charcoal/70" aria-live="polite">
        {page.total > 0 ? `Showing ${from}–${to} of ${page.total} questions` : ""}
      </p>

      {isError && (
        <p role="alert" className="text-small text-destructive">
          Couldn&apos;t load questions. Please try again.
        </p>
      )}

      {page.items.length === 0 ? (
        <p className="text-small text-charcoal/70">
          {query.q ? `No questions match “${query.q}”. Ask it below.` : "No questions yet. Be the first to ask."}
        </p>
      ) : (
        <ul className={cn("flex flex-col divide-y divide-charcoal/10", isFetching && "opacity-60")}>
          {page.items.map((item) => (
            <li key={item.id} className="py-4">
              <article aria-labelledby={`question-${item.id}-text`}>
                <h3 id={`question-${item.id}-text`} className="font-medium text-charcoal">
                  {item.question}
                </h3>
                <p className="mt-1 text-small whitespace-pre-line text-charcoal">{item.answer}</p>
                <p className="mt-2 text-caption text-charcoal/70">
                  Answered by Oristor · <time dateTime={item.publishedAt}>{formatDisplayDate(item.publishedAt)}</time>
                </p>
              </article>
            </li>
          ))}
        </ul>
      )}

      {lastPage > 1 && (
        <nav aria-label="Question pages" className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={query.page <= 1} onClick={() => onPageChange(query.page - 1)}>
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={query.page >= lastPage}
            onClick={() => onPageChange(query.page + 1)}
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Create `src/components/storefront/product/questions/questions-section.tsx`**

```tsx
"use client";

import { useState } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { QaSummary } from "@/services/product-detail-extensions";
import { QUESTION_PAGE_SIZE, type QuestionPage, type QuestionPageQuery } from "@/types/question";

import { QaList } from "./qa-list";
import { QaSearch } from "./qa-search";

interface QuestionsSectionProps {
  productSlug: string;
  /** Fetched by the PDP (server) through the Q&A summary provider. */
  summary: QaSummary | null;
}

/**
 * Owns the list state (search text, page). Kept in component state, not the
 * URL, so the PDP URL stays canonical.
 */
export function QuestionsSection({ productSlug, summary }: QuestionsSectionProps) {
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(searchText.trim(), 300);

  const query: QuestionPageQuery = { page, pageSize: QUESTION_PAGE_SIZE, ...(search ? { q: search } : {}) };
  const initialPage: QuestionPage = {
    items: summary?.previewItems ?? [],
    total: summary?.totalCount ?? 0,
    page: 1,
    pageSize: QUESTION_PAGE_SIZE,
  };

  return (
    <section aria-labelledby="questions-heading" className="flex flex-col gap-6">
      <h2 id="questions-heading" className="text-h3 font-heading text-charcoal">
        Questions &amp; Answers
      </h2>
      <QaSearch
        value={searchText}
        onChange={(value) => {
          setSearchText(value);
          setPage(1);
        }}
      />
      <QaList productSlug={productSlug} initialPage={initialPage} query={query} onPageChange={setPage} />
    </section>
  );
}
```

- [ ] **Step 9: Use `QuestionsSection` on the PDP**

In `src/app/(storefront)/products/[slug]/page.tsx`, add after the `ReviewsSection` import:

```tsx
import { QuestionsSection } from "@/components/storefront/product/questions/questions-section";
```

Replace the whole block that starts `<div className="mt-12">` and contains `<h2 ...>Questions & Answers</h2>` (it ends after the `No questions yet.` paragraph and its closing `</div>`) with:

```tsx
      <div className="mt-12">
        <QuestionsSection productSlug={product.slug} summary={product.qaSummary} />
      </div>
```

- [ ] **Step 10: Run the tests, one file per command**

```bash
npx vitest run tests/unit/question-client.test.ts
npx vitest run tests/unit/questions-section.test.tsx
npx vitest run tests/unit/reviews-section.test.tsx
```

Expected: all PASS with no act() warnings. `reviews-section` confirms the date-formatter swap.

- [ ] **Step 11: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/lib/api/api-error.ts src/lib/api/question-client.ts src/lib/format-date.ts src/components/storefront/product/reviews/review-list.tsx src/components/storefront/product/questions "src/app/(storefront)/products/[slug]/page.tsx" tests/unit/question-client.test.ts tests/unit/questions-section.test.tsx
git commit -m "feat: show searchable, paginated Q&A on the product page" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Ask form and "your questions awaiting an answer"

**Files:**
- Create: `src/components/storefront/product/questions/ask-question-form.tsx`
- Create: `src/components/storefront/product/questions/my-open-questions.tsx`
- Modify: `src/components/storefront/product/questions/questions-section.tsx` (render both)
- Modify: `tests/unit/questions-section.test.tsx` (mock `next-auth/react`)
- Test: `tests/unit/ask-question-form.test.tsx`, `tests/unit/my-open-questions.test.tsx`

**Interfaces:**
- Consumes: `fetchMyQuestions`, `postQuestion`, `ApiError` (Task 8); `questionInputSchema`, `QuestionInput` (Task 2); `formatDisplayDate`; `useSession` from `next-auth/react`.
- Produces: `AskQuestionForm({ productSlug })`, `MyOpenQuestions({ productSlug })`. Both use the query key `["my-questions", productSlug]`.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/ask-question-form.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({ useSession: () => mockUseSession() }));

const { AskQuestionForm } = await import("@/components/storefront/product/questions/ask-question-form");

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AskQuestionForm productSlug="curry" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockUseSession.mockReturnValue({ status: "authenticated", data: { user: { id: "u1" } } });
});

afterEach(() => {
  fetchMock.mockReset();
});

describe("AskQuestionForm", () => {
  it("renders nothing while the session is loading", () => {
    mockUseSession.mockReturnValue({ status: "loading", data: null });

    expect(renderForm().container).toBeEmptyDOMElement();
  });

  it("asks guests to sign in, returning them to this product", () => {
    mockUseSession.mockReturnValue({ status: "unauthenticated", data: null });

    renderForm();

    expect(screen.getByRole("link", { name: "Sign in to ask a question" })).toHaveAttribute(
      "href",
      "/account/login?callbackUrl=%2Fproducts%2Fcurry",
    );
  });

  it("validates on the client and doesn't post a too-short question", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Your question"), "Hot?");
    await user.click(screen.getByRole("button", { name: "Submit question" }));

    expect(await screen.findByText("Question must be at least 10 characters")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits, confirms, clears the box and shows the character count", async () => {
    fetchMock.mockResolvedValue(
      json({ question: { id: "q1", text: "Is it organic?", status: "Pending", createdAt: "2026-09-23T00:00:00.000Z" } }, 201),
    );
    const user = userEvent.setup();
    renderForm();
    const box = screen.getByLabelText("Your question");

    await user.type(box, "Is it organic?");
    expect(screen.getByText("14/500")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Submit question" }));

    expect(await screen.findByText("Thanks! Your question was submitted and is pending review.")).toBeInTheDocument();
    expect(box).toHaveValue("");
    const post = fetchMock.mock.calls[0];
    expect(post?.[0]).toBe("/api/products/curry/questions");
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ text: "Is it organic?" });
  });

  it("shows a server field error", async () => {
    fetchMock.mockResolvedValue(json({ error: "Not allowed", fieldErrors: { text: ["Not allowed"] } }, 400));
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Your question"), "Is it organic?");
    await user.click(screen.getByRole("button", { name: "Submit question" }));

    expect(await screen.findByText("Not allowed")).toBeInTheDocument();
  });
});
```

Create `tests/unit/my-open-questions.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({ useSession: () => mockUseSession() }));

const { MyOpenQuestions } = await import("@/components/storefront/product/questions/my-open-questions");

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

function renderIt() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MyOpenQuestions productSlug="curry" />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  fetchMock.mockReset();
});

describe("MyOpenQuestions", () => {
  it("renders nothing and doesn't fetch for guests", () => {
    mockUseSession.mockReturnValue({ status: "unauthenticated", data: null });

    expect(renderIt().container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lists the customer's open questions", async () => {
    mockUseSession.mockReturnValue({ status: "authenticated", data: { user: { id: "u1" } } });
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ questions: [{ id: "q1", text: "Is it organic?", status: "Pending", createdAt: "2026-09-23T00:00:00.000Z" }] }),
        { status: 200 },
      ),
    );

    renderIt();

    expect(await screen.findByRole("heading", { name: "Your questions awaiting an answer" })).toBeInTheDocument();
    expect(screen.getByText("Is it organic?")).toBeInTheDocument();
  });

  it("renders nothing when the customer has none", async () => {
    mockUseSession.mockReturnValue({ status: "authenticated", data: { user: { id: "u1" } } });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ questions: [] }), { status: 200 }));

    const { container } = renderIt();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

```bash
npx vitest run tests/unit/ask-question-form.test.tsx
npx vitest run tests/unit/my-open-questions.test.tsx
```

Expected: FAIL (unresolved imports).

- [ ] **Step 3: Create `src/components/storefront/product/questions/ask-question-form.tsx`**

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/api-error";
import { postQuestion } from "@/lib/api/question-client";
import { questionInputSchema, type QuestionInput } from "@/validation/question.schema";

const MAX_LENGTH = 500;

export function AskQuestionForm({ productSlug }: { productSlug: string }) {
  const { status } = useSession();

  if (status === "loading") return null;
  if (status === "unauthenticated") {
    const callbackUrl = encodeURIComponent(`/products/${productSlug}`);
    return (
      <p className="text-small text-charcoal">
        <Link href={`/account/login?callbackUrl=${callbackUrl}`} className="font-medium underline underline-offset-4">
          Sign in to ask a question
        </Link>
      </p>
    );
  }
  return <SignedInAskForm productSlug={productSlug} />;
}

function SignedInAskForm({ productSlug }: { productSlug: string }) {
  const queryClient = useQueryClient();
  const [submitted, setSubmitted] = useState(false);
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<QuestionInput>({ resolver: zodResolver(questionInputSchema), defaultValues: { text: "" } });
  const text = useWatch({ control, name: "text" });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitted(false);
    try {
      await postQuestion(productSlug, values);
      reset({ text: "" });
      setSubmitted(true);
      void queryClient.invalidateQueries({ queryKey: ["my-questions", productSlug] });
    } catch (error) {
      const fieldMessage = error instanceof ApiError ? error.fieldErrors.text?.[0] : undefined;
      if (fieldMessage) {
        setError("text", { message: fieldMessage });
        return;
      }
      setError("root", {
        message: error instanceof ApiError ? error.message : "Something went wrong. Please try again.",
      });
    }
  });

  const describedBy = ["question-text-count", errors.text ? "question-text-error" : ""].filter(Boolean).join(" ");

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-2">
      <h3 className="text-h4 font-heading text-charcoal">Ask a question</h3>
      <Label htmlFor="question-text">Your question</Label>
      <textarea
        id="question-text"
        rows={3}
        maxLength={MAX_LENGTH}
        aria-invalid={errors.text ? true : undefined}
        aria-describedby={describedBy}
        className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
        {...register("text")}
      />
      <p id="question-text-count" className="text-caption text-charcoal/70">
        {text.length}/{MAX_LENGTH}
      </p>
      {errors.text && (
        <p id="question-text-error" className="text-small text-destructive">
          {errors.text.message}
        </p>
      )}
      {errors.root && (
        <p role="alert" className="text-small text-destructive">
          {errors.root.message}
        </p>
      )}
      {submitted && (
        <p role="status" className="text-small font-medium text-charcoal">
          Thanks! Your question was submitted and is pending review.
        </p>
      )}
      <div>
        <Button type="submit" disabled={isSubmitting}>
          Submit question
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Create `src/components/storefront/product/questions/my-open-questions.tsx`**

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { fetchMyQuestions } from "@/lib/api/question-client";
import { formatDisplayDate } from "@/lib/format-date";

/** The signed-in customer's own questions that haven't been published yet. */
export function MyOpenQuestions({ productSlug }: { productSlug: string }) {
  const { status } = useSession();
  const { data } = useQuery({
    queryKey: ["my-questions", productSlug],
    queryFn: () => fetchMyQuestions(productSlug),
    enabled: status === "authenticated",
  });

  if (status !== "authenticated" || !data || data.length === 0) return null;

  return (
    <div className="rounded-lg border border-charcoal/10 p-4">
      <h3 className="text-h4 font-heading text-charcoal">Your questions awaiting an answer</h3>
      <ul className="mt-2 flex flex-col gap-2">
        {data.map((question) => (
          <li key={question.id}>
            <p className="text-small text-charcoal">{question.text}</p>
            <p className="text-caption text-charcoal/70">
              Asked <time dateTime={question.createdAt}>{formatDisplayDate(question.createdAt)}</time>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 5: Render both in `QuestionsSection`**

In `src/components/storefront/product/questions/questions-section.tsx`, add the imports after `import { QaSearch } from "./qa-search";`:

```tsx
import { AskQuestionForm } from "./ask-question-form";
import { MyOpenQuestions } from "./my-open-questions";
```

and add these as the last two children of the `<section>`, after `<QaList ... />`:

```tsx
      <MyOpenQuestions productSlug={productSlug} />
      <AskQuestionForm productSlug={productSlug} />
```

- [ ] **Step 6: Mock the session in the section test**

In `tests/unit/questions-section.test.tsx`, add directly after the `vitest` import line:

```ts
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: "unauthenticated", data: null }) }));
```

- [ ] **Step 7: Run the tests, one file per command**

```bash
npx vitest run tests/unit/ask-question-form.test.tsx
npx vitest run tests/unit/my-open-questions.test.tsx
npx vitest run tests/unit/questions-section.test.tsx
```

Expected: all PASS, no act() warnings.

- [ ] **Step 8: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/components/storefront/product/questions tests/unit/ask-question-form.test.tsx tests/unit/my-open-questions.test.tsx tests/unit/questions-section.test.tsx
git commit -m "feat: add ask-a-question form and the asker's pending questions" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Dev publish path and seed demo Q&A

**Files:**
- Modify: `src/services/qa.service.ts` (append `advanceQuestionToPublished`)
- Create: `scripts/publish-question.ts`
- Modify: `package.json` (`scripts`)
- Modify: `prisma/seed.ts` (import; a block before the final `console.log`)
- Test: `tests/unit/qa-lifecycle.test.ts` (append a `describe`)

**Interfaces:**
- Consumes: `answerQuestion`, `changeQuestionStatus`, `submitQuestion`.
- Produces: `advanceQuestionToPublished(questionId: string, answerText: string): Promise<Question>`.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/qa-lifecycle.test.ts`, and add `advanceQuestionToPublished` to its import from `@/services/qa.service`:

```ts
describe("advanceQuestionToPublished", () => {
  it("answers, approves and publishes a Pending question, notifying once", async () => {
    const question = await makePendingQuestion();

    const published = await advanceQuestionToPublished(question.id, "Medium heat.");

    expect(published).toMatchObject({ status: "Published", answerText: "Medium heat." });
    expect(onQuestionPublished).toHaveBeenCalledOnce();
  });

  it("leaves a Published question as it is", async () => {
    const question = await makePendingQuestion();
    await advanceQuestionToPublished(question.id, "Medium heat.");

    expect((await advanceQuestionToPublished(question.id, "Ignored")).answerText).toBe("Medium heat.");
    expect(onQuestionPublished).toHaveBeenCalledOnce();
  });

  it("refuses a Rejected question", async () => {
    const question = await makePendingQuestion();
    await changeQuestionStatus(question.id, "Rejected");

    await expect(advanceQuestionToPublished(question.id, "Answer.")).rejects.toBeInstanceOf(InvalidQuestionTransitionError);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/unit/qa-lifecycle.test.ts`
Expected: FAIL, `advanceQuestionToPublished is not a function`.

- [ ] **Step 3: Append to `src/services/qa.service.ts`**

```ts
// ---------------------------------------------------------------------------
// Dev tooling
// ---------------------------------------------------------------------------

/**
 * Walks a question to Published through the real workflow (answer → approve
 * → publish), so the notify-customer hook fires exactly as in production.
 * For the seed, the qa:publish script and e2e tests only. In production,
 * staff publish from the moderation console (STORY-046).
 */
export async function advanceQuestionToPublished(questionId: string, answerText: string) {
  const question = await qaRepository.findQuestionById(questionId);
  if (!question) throw new QuestionNotFoundError();
  if (question.status === "Published") return question;

  let status: QuestionStatus = question.status;
  if (status === "Pending") status = (await answerQuestion(questionId, answerText)).status;
  if (status === "Answered") status = (await changeQuestionStatus(questionId, "Approved")).status;
  if (status === "Approved") return changeQuestionStatus(questionId, "Published");
  throw new InvalidQuestionTransitionError(status, "Published");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/qa-lifecycle.test.ts`
Expected: PASS.

- [ ] **Step 5: Create `scripts/publish-question.ts`**

```ts
/**
 * Dev-only: answers and publishes a question without the moderation console
 * (STORY-046).
 *   npm run qa:publish -- <questionId> "<answer text>"
 * Goes through qa.service.ts's real workflow, so the notify-customer hook
 * fires exactly as it will in production.
 */
import "dotenv/config";

import { prisma } from "../src/lib/db";
import { advanceQuestionToPublished } from "../src/services/qa.service";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "qa:publish is a local development tool. In production, questions are published from the moderation console (STORY-046).",
    );
  }
  const [questionId, answerText] = process.argv.slice(2);
  if (!questionId || !answerText) throw new Error('Usage: npm run qa:publish -- <questionId> "<answer text>"');

  const question = await advanceQuestionToPublished(questionId, answerText);
  console.log(`Question ${question.id} is now ${question.status}.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 6: Add the npm script**

In `package.json` `"scripts"`, after `"review:publish": "tsx scripts/publish-review.ts"`, add a comma and:

```json
    "qa:publish": "tsx scripts/publish-question.ts"
```

- [ ] **Step 7: Add demo Q&A to `prisma/seed.ts`**

Add after the existing `review.service` import at the top:

```ts
import { advanceQuestionToPublished, submitQuestion } from "../src/services/qa.service";
```

Insert before the final `console.log("Seed complete:", { ... })` in `main()`. This goes after the demo-review block, which defines the `nadeesha` and `kamal` users.

```ts
  // Demo Q&A (STORY-016), published through the real Q&A workflow. Kept off
  // the curry powder: tests/e2e/product-detail.spec.ts expects that PDP to
  // show "No questions yet.".
  const demoQuestions = [
    {
      userId: kamal.id,
      slug: chilliPowder.slug,
      text: "Is this chilli powder very hot, or suitable for children's dishes?",
      answer: "It's a medium-hot blend. For children's dishes, start with a pinch and add coconut milk to mellow it.",
    },
    {
      userId: nadeesha.id,
      slug: chilliPowder.slug,
      text: "How should I store it once the pack is opened?",
      answer: "Keep it in an airtight container away from light and moisture. It stays fresh for about six months.",
    },
    {
      userId: kamal.id,
      slug: giftSet.slug,
      text: "Can I add a personal message to the gift set?",
      answer: "Yes. Add a note at checkout and we'll include a handwritten card.",
    },
  ];
  for (const demo of demoQuestions) {
    const question = await submitQuestion(demo.userId, demo.slug, { text: demo.text });
    await advanceQuestionToPublished(question.id, demo.answer);
  }
```

- [ ] **Step 8: Verify the seed and the script**

```bash
npx prisma db execute --file tests/unit/truncate-all.sql
npx prisma db seed; echo "seed exit=$?"
npm run qa:publish -- does-not-exist "An answer"; echo "exit=$?"
NODE_ENV=production npm run qa:publish -- anything "An answer"; echo "exit=$?"
```

Expected: `seed exit=0`; the seed output includes `[qa-notify]` lines (the default logging notifier, expected in dev). The first script run prints `Question not found` and `exit=1`. The production run prints the "local development tool" message and `exit=1`.

- [ ] **Step 9: Typecheck, lint, commit**

```bash
npx tsc --noEmit && npm run lint
git add src/services/qa.service.ts scripts/publish-question.ts package.json prisma/seed.ts tests/unit/qa-lifecycle.test.ts
git commit -m "feat: add dev Q&A publish script and seed demo Q&A" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: End-to-end tests

**Files:**
- Create: `tests/e2e/product-qa.spec.ts`

**Interfaces:**
- Consumes: `submitQuestion`, `advanceQuestionToPublished` (Tasks 6, 10); `signInAs` from `tests/e2e/helpers/auth.ts` (STORY-015); the PDP UI (Tasks 8–9).

- [ ] **Step 1: Write the spec**

Create `tests/e2e/product-qa.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import { prisma } from "@/lib/db";
import { createStandardPrice } from "@/repositories/pricing.repository";
import { createProduct } from "@/repositories/product.repository";
import { advanceQuestionToPublished, submitQuestion } from "@/services/qa.service";

import { signInAs } from "./helpers/auth";

const SKU_PREFIX = "E2E-QA-";
const EMAIL_DOMAIN = "@e2e-qa.test";

async function seedProduct(n: number, name: string) {
  const product = await createProduct({ sku: `${SKU_PREFIX}${n}`, slug: `e2e-qa-${n}`, name, status: "Published" });
  await createStandardPrice({ product: { connect: { id: product.id } }, price: "450.00" });
  return product;
}

async function seedUser(label: string) {
  return prisma.user.create({ data: { email: `${label}${EMAIL_DOMAIN}`, name: label } });
}

async function seedPublishedQa(productSlug: string, userId: string, text: string, answer: string) {
  const question = await submitQuestion(userId, productSlug, { text });
  await advanceQuestionToPublished(question.id, answer);
}

test.describe("Product Q&A", () => {
  // The tests share SKU/email prefixes cleaned up in beforeEach.
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async () => {
    // Questions cascade with their product and user.
    await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  });

  test("a submitted question stays private but shows as awaiting an answer", async ({ page }) => {
    const product = await seedProduct(1, "E2E QA Cinnamon");
    const user = await seedUser("asker");
    await signInAs(page, user.id);

    await page.goto(`/products/${product.slug}`);
    await page.getByLabel("Your question").fill("Is this cinnamon Ceylon or cassia?");
    await page.getByRole("button", { name: "Submit question" }).click();
    await expect(page.getByText("Thanks! Your question was submitted and is pending review.")).toBeVisible();

    await page.reload();
    const section = page.locator('section[aria-labelledby="questions-heading"]');
    await expect(section.getByText("No questions yet.")).toBeVisible();
    await expect(section.getByRole("heading", { name: "Is this cinnamon Ceylon or cassia?" })).toHaveCount(0);
    await expect(section.getByRole("heading", { name: "Your questions awaiting an answer" })).toBeVisible();
    await expect(section.getByText("Is this cinnamon Ceylon or cassia?")).toBeVisible();
  });

  test("published Q&A renders and the search filters it", async ({ page }) => {
    const product = await seedProduct(2, "E2E QA Pepper");
    const asker = await seedUser("reader");
    await seedPublishedQa(product.slug, asker.id, "How should I store the peppercorns?", "In an airtight jar away from light.");
    await seedPublishedQa(product.slug, asker.id, "Are these peppercorns organic?", "Yes, certified organic.");

    await page.goto(`/products/${product.slug}`);
    const section = page.locator('section[aria-labelledby="questions-heading"]');
    await expect(section.getByRole("heading", { name: "How should I store the peppercorns?" })).toBeVisible();
    await expect(section.getByText("In an airtight jar away from light.")).toBeVisible();

    await section.getByLabel("Search questions about this product").fill("organic");
    await expect(section.getByRole("heading", { name: "How should I store the peppercorns?" })).toHaveCount(0);
    await expect(section.getByRole("heading", { name: "Are these peppercorns organic?" })).toBeVisible();

    await section.getByLabel("Search questions about this product").fill("delivery");
    await expect(section.getByText("No questions match “delivery”. Ask it below.")).toBeVisible();
  });

  test("the Q&A section has no detectable accessibility violations", async ({ page }) => {
    const product = await seedProduct(3, "E2E QA Cloves");
    const user = await seedUser("a11y");
    await seedPublishedQa(product.slug, user.id, "Are the cloves whole or ground?", "Whole, hand-picked cloves.");
    await signInAs(page, user.id);

    await page.goto(`/products/${product.slug}`);
    await expect(page.getByRole("button", { name: "Submit question" })).toBeVisible();

    const results = await new AxeBuilder({ page }).include('section[aria-labelledby="questions-heading"]').analyze();
    expect(results.violations).toEqual([]);
  });
});
```

- [ ] **Step 2: Prepare a fresh local environment**

These steps restart the database, following the procedure in `docs/architecture-decisions.md`:
1. Find and kill the process listening on 51214 (`netstat -ano | grep ":51214 .*LISTEN"`, then `taskkill //F //PID <pid> //T`), and wait about 25 seconds.
2. `npx prisma dev --detach --db-port 51214 --shadow-db-port 51215` and wait until it is LISTENING.
3. `npx prisma db push`
4. `npx prisma db execute --file tests/unit/truncate-all.sql`
5. `npx prisma db seed`, and check the exit code is 0.

Then start a **fresh** dev server (`npm run dev`). A dev server that outlived a database restart keeps dead connections. If port 3000 is already in use by another worktree's server, stop that server first and say so in your report.

- [ ] **Step 3: Run the new spec plus the specs it can affect**

Run: `npx playwright test tests/e2e/product-qa.spec.ts tests/e2e/product-detail.spec.ts tests/e2e/product-reviews.spec.ts --workers=1`
Expected: all pass.

If "published Q&A renders" shows "No questions yet." even though the seed ran, the startup registration isn't reaching the page: check the dev-server log for a `register` error and check `src/instrumentation.ts`. Do NOT work around it by importing Q&A code into `product.service.ts`. If a run fails with `ConnectionClosed` / `P1001`, repeat Step 2 and re-run only the failing spec.

- [ ] **Step 4: Stop the dev server you started, then commit**

```bash
npx tsc --noEmit && npm run lint
git add tests/e2e/product-qa.spec.ts
git commit -m "test: add Playwright e2e coverage for product Q&A" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Documentation and story status

**Files:**
- Modify: `docs/architecture-decisions.md` (append an entry)
- Modify: `docs/stories/03-product-platform/STORY-016-product-qa.md`
- Modify: `docs/stories/README.md` (the STORY-016 row)

**Interfaces:** none. This is the final ship step.

- [ ] **Step 1: Append to `docs/architecture-decisions.md`**

```markdown

---

## 2026-09-23 — STORY-016 Product Q&A

**Status lifecycle.** `Question.status` is one of `Pending`, `Answered`,
`Approved`, `Published`, `Rejected`. Allowed moves: Pending→Answered,
Pending→Rejected, Answered→Approved, Answered→Rejected, Approved→Published,
Approved→Rejected, Published→Rejected (take down). `Rejected` is terminal.
**`answerQuestion(questionId, answerText, moderatorId)` is the only way into
`Answered`** (it sets `answerText`/`answeredById`/`answeredAt` in the same
write), and **`changeQuestionStatus(questionId, next)` handles every other
move** and refuses `Answered`. Both write conditionally on the status they
read, so concurrent moderation gets a clean 409. The STORY-046 console must
use these two functions and pass `moderatorId`. It is optional only so the
dev tooling can answer without a staff account.

**Answer stored on the question.** One official staff answer per question
(blueprint flow), so the answer is three nullable columns on `Question`
rather than a separate `Answer` table. A future community-answers feature
would add a table.

**Notification hooks (for STORY-032).** `src/services/qa-notifications.ts`
defines `QuestionSubmittedEvent` (notify admin) and `QuestionPublishedEvent`
(notify customer), and `registerQaNotifier({ onQuestionSubmitted,
onQuestionPublished })`. Contract: `qa.service.ts` calls them only after
the database write succeeds, and `notify*()` catches and logs notifier
errors, so delivery problems never fail a submission or a publish. The
registry lives on `globalThis` (register from `src/instrumentation.ts`,
same as the product-detail providers). The default notifier logs a
`[qa-notify]` line. That is the temporary fallback until STORY-032.

**Customer-facing behaviour.** Customers may have any number of open
questions per product. `GET /questions/mine` returns the asker's own
Pending/Answered/Approved questions (never Rejected), shown as "Your
questions awaiting an answer". The public list is Published only, with a
`q` keyword filter: every whitespace-separated word must appear,
case-insensitively, in the question or its answer.

**Shared response helpers.** `unauthorizedResponse` and
`validationErrorResponse` moved from `review-responses.ts` to
`src/lib/api/responses.ts`, and the browser clients' error type is the
generic `ApiError<F>` in `src/lib/api/api-error.ts`. `review-client.ts`
still has its own `ReviewApiError`, and could migrate to `ApiError` later.

**Publishing Q&A without the moderation console.** Locally:
`npm run qa:publish -- <questionId> "<answer text>"` (refuses to run with
`NODE_ENV=production`). The seed publishes three demo Q&A pairs on chilli
powder and the gift set (not curry powder, whose PDP e2e test expects the
empty state) through `advanceQuestionToPublished()`.
```

- [ ] **Step 2: Update the story file**

In `docs/stories/03-product-platform/STORY-016-product-qa.md`:
- Change `**Status:** Draft` to `**Status:** Done`.
- Check (`- [x]`) every acceptance criterion and task line. Before checking each one, confirm the implementation satisfies it. The `Answer` model line is satisfied by the answer fields on `Question`: append ` _(implemented as answer fields on Question, see docs/architecture-decisions.md 2026-09-23)_` to both the acceptance criterion and the Database task line that mention the `Answer` model.

- [ ] **Step 3: Update `docs/stories/README.md`**

Change the `STORY-016` row's status from `Draft` to `Done`. Open the file first to copy the row's exact text.

- [ ] **Step 4: Final verification**

```bash
npx tsc --noEmit && npm run lint
npx vitest run tests/unit/qa-lifecycle.test.ts
npx vitest run tests/unit/qa-service.test.ts
npx vitest run tests/unit/qa-routes.test.ts
```

Expected: no type or lint errors, and all three files pass.

- [ ] **Step 5: Commit**

```bash
git add docs/architecture-decisions.md docs/stories/03-product-platform/STORY-016-product-qa.md docs/stories/README.md
git commit -m "docs: mark STORY-016 done; document Q&A lifecycle and notification hooks" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- **Spec coverage:**
  - Data model → Task 1
  - Validation → Task 2
  - Repository with conditional writes → Task 3
  - Hooks and errors → Task 4
  - Lifecycle → Task 5
  - Submit, list, keyword filter, mine, PDP provider → Task 6
  - Routes and the shared-helper refactor → Task 7
  - Search, list, section → Task 8
  - Ask form and my open questions → Task 9
  - Dev path and seed → Task 10
  - E2E → Task 11
  - Docs → Task 12
- **Deviations from the spec, noted:**
  - (1) `changeQuestionStatus(questionId, next)` has no `{ moderatorId? }` option. Nothing on `Question` would store it (only the answer has an author), so the option was dropped as YAGNI.
  - (2) `answerQuestion`'s `moderatorId` is optional so the seed and `qa:publish` can answer without a staff account. `answeredById` is already nullable.
  - (3) The browser error type is a new generic `ApiError<F>`. `review-client.ts` is left as is and documented as a later cleanup.
- **Type consistency:**
  - `PublicQuestion` / `QaPreview` / `OwnQuestion` / `QuestionPage` are defined in Task 2 and used unchanged in Tasks 6–9.
  - The query key `["my-questions", slug]` is shared by `AskQuestionForm` (invalidate) and `MyOpenQuestions`.
  - `QuestionListQuery.q` is `string | undefined` on the server; `QuestionPageQuery.q` is optional on the client.
