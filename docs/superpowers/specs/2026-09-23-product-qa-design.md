# Product Q&A — Design

**Story:** `docs/stories/03-product-platform/STORY-016-product-qa.md`
**Date:** 2026-09-23
**Branch:** `feature/story-016-product-qa`, based on
`feature/story-015-product-reviews` (PR #3, itself stacked on #2). It reuses
STORY-015's `globalThis` provider registry and `src/instrumentation.ts`, and
edits the same PDP. Retarget to `master` once the earlier PRs merge.

## Summary

A signed-in customer asks a question on a product page. The question is
stored as `Pending`, and a "notify admin" hook fires. Staff answer, approve
and publish it (the STORY-046 console, not built yet). Publishing fires a
"notify customer" hook. The PDP shows only `Published` question+answer
pairs, in a paginated list with a keyword search box above it, placed
before the ask form so customers find existing answers before asking.
Signed-in customers also see their own questions that are still awaiting
an answer.

Decisions confirmed with the user before design:

- **Signed-in customers see their own pending questions** ("Your questions
  awaiting an answer"), so the confirmation isn't lost on reload. This adds
  `GET /questions/mine`. The story only required a one-time confirmation.
- **The answer is stored as fields on `Question`**, not in a separate
  `Answer` table (the story allows either). The blueprint's flow has one
  official staff answer per question. A separate table only helps with
  multiple (for example community) answers, which is out of scope.
- **The keyword filter runs on the server** through the list endpoint's
  `q` parameter: case-insensitive, every word must appear in the question
  or its answer. Fuzzy/trigram matching (as in STORY-012 search) was
  rejected as overkill for a handful of questions per product.
  Client-side filtering was rejected because it misses pages that aren't
  loaded.

Not in this story: customer edit/withdraw of questions (not required),
admin answer/approve/publish UI (STORY-046), real notification delivery
(STORY-032), and recipe Q&A (Epic 04).

## Data model

```prisma
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

`User` gains `questions Question[] @relation("QuestionAsker")` and
`answeredQuestions Question[] @relation("QuestionAnswerer")`. `Product`
gains `questions Question[]`.

Rules:

- **No uniqueness constraint.** A customer may have any number of open
  questions on the same product (acceptance criterion).
- **An `Answered`, `Approved` or `Published` question always has
  `answerText`.** Only `answerQuestion()` can enter `Answered`, and it sets
  the answer fields in the same write.
- **`publishedAt`** is set on entering `Published`. The public list sorts
  by `publishedAt desc, id asc` so pagination is stable.
- **Account deletion** cascades to the asker's questions, matching reviews
  and wishlist. Deleting a staff member sets `answeredById` to null and
  keeps the answer text.
- **Migration:** a committed migration generated offline with
  `prisma migrate diff --from-schema <old> --to-schema <new> --script`, as
  in STORY-012 and STORY-015.

## Status lifecycle

```
Pending ──answerQuestion()──► Answered ──► Approved ──► Published
   │                            │            │             │
   └──────────► Rejected ◄──────┴────────────┴─────────────┘
```

| From      | To                   | Via |
|-----------|----------------------|-----|
| Pending   | Answered             | `answerQuestion()` only |
| Pending   | Rejected             | `changeQuestionStatus()` |
| Answered  | Approved, Rejected   | `changeQuestionStatus()` |
| Approved  | Published, Rejected  | `changeQuestionStatus()` |
| Published | Rejected             | `changeQuestionStatus()` (take down) |

`Rejected` is terminal. `changeQuestionStatus(…, "Answered")` is refused, so
the answer path cannot be bypassed. Both functions write conditionally on
the status they read (`updateMany where { id, status: fromStatus }`), and a
0-row write throws `InvalidQuestionTransitionError`. This is the same guard
STORY-015 uses against concurrent moderation.

## Backend

### Notification hooks: `src/services/qa-notifications.ts`

```ts
export interface QuestionSubmittedEvent {
  questionId: string; productId: string; productSlug: string; productName: string;
  text: string; askedByUserId: string; submittedAt: Date;
}
export interface QuestionPublishedEvent {
  questionId: string; productId: string; productSlug: string; productName: string;
  askedByUserId: string; publishedAt: Date;
}
export interface QaNotifier {
  onQuestionSubmitted(event: QuestionSubmittedEvent): Promise<void>;
  onQuestionPublished(event: QuestionPublishedEvent): Promise<void>;
}
export function registerQaNotifier(notifier: QaNotifier): void;
export function notifyQuestionSubmitted(event: QuestionSubmittedEvent): Promise<void>;
export function notifyQuestionPublished(event: QuestionPublishedEvent): Promise<void>;
export function resetQaNotifierForTesting(): void;
```

- **Registry on `globalThis`** (`__oristorQaNotifier`), same reasoning as
  `product-detail-extensions.ts` and `purchase-verification.ts`: STORY-032
  registers real delivery from `src/instrumentation.ts`, which Next bundles
  separately from route code.
- **The default notifier logs** `console.info("[qa-notify] question
  submitted …")` / `"… published …"`. This is the documented temporary
  fallback until STORY-032.
- **Hooks never break the action.** `notify*` is called after the database
  write succeeds; `notify*` catches and `console.error`s any notifier
  error, so a failing notifier cannot fail a submission or a publish.

### Repository: `src/repositories/qa.repository.ts`

The only file that touches Prisma for questions:

- `createQuestion`
- `findQuestionById`
- `listPublishedQuestions(productId, { words, skip, take })` returning
  `{ items, total }`. Each word adds an `AND` of `OR(text contains word,
  answerText contains word)`, with `mode: "insensitive"`; status is always
  `Published`.
- `listOpenQuestionsByUser(productId, userId)`: statuses `Pending`,
  `Answered` or `Approved`, newest first.
- `answerPendingQuestion(id, { answerText, answeredById, answeredAt })`:
  conditional on `status: Pending`; returns the row or `null`.
- `updateQuestionStatus(id, fromStatus, data)`: conditional; returns the
  row or `null`.

### Service: `src/services/qa.service.ts`

| Function | Behaviour |
|---|---|
| `submitQuestion(userId, productSlug, input)` | Product must be `Published` (else `ProductNotFoundError`). Re-validates input. Creates `Pending`, then `notifyQuestionSubmitted`. Returns `OwnQuestion`. |
| `listPublishedQuestions(productSlug, query)` / `listPublishedQuestionsForProduct(productId, query)` | Published only. `q` is split on whitespace into words (empty → no filter). Returns `{ items, total, page, pageSize }`. |
| `listMyOpenQuestions(userId, productSlug)` | The customer's Pending/Answered/Approved questions on that product. |
| `answerQuestion(questionId, answerText, moderatorId)` | Pending → Answered and sets the answer fields; `InvalidQuestionTransitionError` from any other status; validates the answer text is 1–2000 characters. |
| `changeQuestionStatus(questionId, next, { moderatorId? })` | Validates the transition table (never `Answered`), writes conditionally, sets `publishedAt` on `Published`, then `notifyQuestionPublished` after a successful publish. |
| `getQaSummaryForProduct(productId)` / `registerQaProviders()` | PDP provider: `null` when there are no Published questions; otherwise the first page (10) and `totalCount`. Registered from `src/instrumentation.ts` alongside `registerReviewProviders()`. |
| `advanceQuestionToPublished(questionId, answerText)` | Dev/seed/e2e helper: answer (if Pending) → Approved → Published through the real functions. |

Errors live in `src/services/qa.errors.ts` as typed classes with a `code`,
like `review.errors.ts`: `invalid_input` 400, `product_not_found` 404,
`question_not_found` 404, `invalid_transition` 409. They are mapped to HTTP
responses in `src/lib/api/qa-responses.ts`. That file reuses the shared
401/validation helpers by moving them from `review-responses.ts` into a
common `src/lib/api/responses.ts`, so the two features don't duplicate
them.

### PDP contract change

`QaPreview` in `product-detail-extensions.ts` becomes the public DTO:

```ts
export interface PublicQuestion {
  id: string; question: string; answer: string; publishedAt: string; // ISO
}
export type QaPreview = PublicQuestion;
export interface QaSummary { previewItems: QaPreview[]; totalCount: number; }
```

`PublicQuestion` and the other client-safe types live in
`src/types/question.ts`. Existing test fixtures that use `createdAt: Date`
are updated.

### API routes: `src/app/api/products/[slug]/questions/`

| Method | Path | Auth | Success | Errors |
|---|---|---|---|---|
| GET | `/questions?page&pageSize&q` | public | 200 `{ items, total, page, pageSize }` | 400, 404 |
| POST | `/questions` | session | 201 `{ question: OwnQuestion }` | 400, 401, 404 |
| GET | `/questions/mine` | session | 200 `{ questions: OwnQuestion[] }` | 401, 404 |

### Validation: `src/validation/question.schema.ts`

- `questionInputSchema`: `text` trimmed, 10–500 characters.
- `questionListQuerySchema`: `page` default 1, `pageSize` default 10 (max
  50), `q` trimmed, max 100 characters, optional.

### Dev-only publish path

`scripts/publish-question.ts` is run as
`npm run qa:publish -- <questionId> "<answer text>"`. It calls
`advanceQuestionToPublished`, which fires notify-customer, and refuses to
run when `NODE_ENV=production`. `prisma/seed.ts` adds two or three Published
Q&A pairs on chilli powder and the gift set through the same helper. None
go on `roasted-curry-powder-100g`, because `tests/e2e/product-detail.spec.ts`
expects "No questions yet." there.

## Frontend

`QuestionsSection` (client, in `src/components/storefront/product/questions/`)
replaces the PDP's placeholder "Questions & Answers" block. The PDP passes
the server-fetched `QaSummary` in. It owns the list state (`page`, `q`).
Components, in page order:

1. **Heading** "Questions & Answers" (h2), with `section aria-labelledby`.
2. **`QaSearch`**: a labelled search input ("Search questions about this
   product"), debounced (reusing `src/hooks/use-debounced-value.ts`).
   Changing it resets to page 1.
3. **`QaList`** (TanStack Query, `initialData` only for page 1 with no `q`,
   `keepPreviousData`). Each item is an `article` with the question as an
   h3, then the answer and the published date (same fixed-locale formatter
   as reviews). It has Previous/Next pagination and an `aria-live` line
   "Showing x–y of N questions".
   - Empty with no `q`: "No questions yet. Be the first to ask."
   - Empty with `q`: "No questions match “…”. Ask it below."
4. **`MyOpenQuestions`** (signed-in only, hidden when empty): "Your
   questions awaiting an answer", each showing its text and submitted date.
5. **`AskQuestionForm`** (React Hook Form + `questionInputSchema`):
   - Guest: "Sign in to ask a question" link to
     `/account/login?callbackUrl=<pdp>`.
   - Signed in: a labelled textarea "Your question" with a live character
     count and inline errors (`aria-invalid`/`aria-describedby`), and a
     "Submit question" button.
   - On 201: "Thanks! Your question was submitted and is pending review."
     The form resets, and the `my-questions` query is invalidated so it
     appears in `MyOpenQuestions`.

Only one element on the page may contain "No questions yet." (the list's
empty state), to keep `product-detail.spec.ts` passing under Playwright's
strict mode.

## Error handling

- Hooks run after a successful write. Their failures are logged, never
  thrown.
- Conditional writes turn a concurrent status change into a clean 409.
- An unpublished or unknown product returns 404 on every endpoint.
- Form errors: 400 `fieldErrors.text` shows inline; other failures show a
  root error message.

## Testing

**Unit (Vitest, real DB, run sharded locally):**

- The transition table (all pairs); `changeQuestionStatus` refuses
  `Answered`; `answerQuestion` from non-Pending throws; conditional writes
  return `null` on a stale from-status.
- Only `Published` questions are listed. Keyword matching: every word must
  match, in either field, case-insensitively; a blank `q` lists all;
  pagination is stable.
- `listMyOpenQuestions` excludes Rejected, Published and other users'
  questions.
- Hooks: notify-admin fires once on submit with the right event;
  notify-customer fires once on publish only; neither fires on other
  transitions; a throwing notifier doesn't fail the action; the registry is
  shared across module instances.
- Routes: every status code in the API table. Components: search resets
  the page, the empty states, the form's guest/signed-in/submitted states,
  and `MyOpenQuestions` hides when empty.

**E2E (Playwright):**

- A signed-in customer asks a question. It does not appear in the public
  list, but it does appear under "awaiting an answer".
- A Q&A published via `advanceQuestionToPublished` renders, and the search
  box filters it in and out.
- An axe check on the Q&A section reports no violations.

## Documentation

- `docs/architecture-decisions.md`: the Question lifecycle and transition
  table; `answerQuestion` / `changeQuestionStatus` as STORY-046's entry
  points; the notify-hook contracts for STORY-032 (events, after-write
  timing, errors swallowed, `globalThis` registry, log fallback); the dev
  publish path.
- STORY-016 marked Done, and the README row updated.
