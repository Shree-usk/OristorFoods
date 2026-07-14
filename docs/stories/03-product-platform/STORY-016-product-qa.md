# STORY-016: Product Q&A

**Status:** Draft
**Epic:** 03 — Product Platform
**Priority:** Medium
**Persona(s):** Home Cook, Sri Lankan Expat

## User Story
As a Home Cook, I want to ask a question about a product directly on its page, so that I can get an answer before deciding to buy.

As a Sri Lankan Expat, I want to see questions other customers have already asked and answered, so that I can find the information I need without submitting a duplicate question.

## Description
This story implements the customer-facing ask/view Q&A flow described in `docs/blueprint.md` Section 4's Product Detail Page requirements ("Q&A") and Section 7's Questions & Answers module, which specifies a `submit → notify admin → answer → approve → publish → notify customer` flow. This story covers the customer-facing submission and viewing UI plus the underlying data model and API for that entire flow; the admin-side answer/approve/publish actions belong to the **Q&A Moderation Console** (STORY-046, Epic 07), and this story only defines the data contract and notification hooks that console will act on.

## Acceptance Criteria
- [ ] A logged-in customer can submit a question on a product's Q&A section from the Product Detail Page
- [ ] A `Question` Prisma model exists with a status enum (`Pending`/`Answered`/`Approved`/`Published`/`Rejected`) matching the blueprint Section 7 flow, and an `Answer` model (or embedded answer fields) storing the response text, `answeredBy`, and `answeredAt`, reserved for STORY-046 to populate
- [ ] Submitting a question creates it with status `Pending` and triggers a "notify admin" event/hook; if the Notifications module (STORY-032, Epic 05) is not yet built, this falls back to a logged/dev-visible event rather than failing the submission
- [ ] Only `Published` questions (with their published answer) are ever returned to public/storefront read endpoints
- [ ] The Product Detail Page (STORY-011's integration point) displays a paginated list of `Published` Q&A pairs
- [ ] Before submitting a new question, the customer sees a basic keyword filter/search over existing `Published` questions on that product, to reduce duplicate submissions
- [ ] A customer can have multiple open (`Pending`) questions on the same product; submitting a new one is never blocked by an existing unanswered one
- [ ] When a customer's question transitions to `Published`, a "notify customer" event/hook fires (same fallback behavior as above if STORY-032 isn't available yet)
- [ ] The question submission form validates required fields (non-empty question text, reasonable length bounds) client-side and server-side
- [ ] Because there is no admin answer/approve/publish UI yet (STORY-046 not built), a documented seed/dev-only path exists to create a `Published` question+answer pair for local testing and demoing the storefront display

## Tasks

- [ ] **Database:**
  - [ ] Add `Question` model (question text, status enum, `productId`, `userId` (submitter), timestamps) to `prisma/schema.prisma`
  - [ ] Add `Answer` model (or fields) linked to `Question` (answer text, `answeredBy`, `answeredAt`), reserved for STORY-046
  - [ ] Run and verify the migration

- [ ] **API:**
  - [ ] `POST /api/products/[slug]/questions` — submit a question (authenticated)
  - [ ] `GET /api/products/[slug]/questions` — list `Published` question+answer pairs with pagination and keyword filter param

- [ ] **Service/Backend:**
  - [ ] Implement `qa.service.ts` (submit question, list published Q&A, keyword-filter existing questions) calling a new `qa.repository.ts`
  - [ ] Implement the notify-admin event hook fired on submission and the notify-customer event hook fired on publish, both as typed function calls that STORY-032 can wire to real delivery later, with a console/log fallback documented as temporary

- [ ] **Frontend:**
  - [ ] Build the "Ask a question" form component, including the pre-submit keyword filter against existing published questions
  - [ ] Build the Q&A list component (pagination) for PDP integration per STORY-011's contract
  - [ ] Build a "your question was submitted and is pending review" confirmation state

- [ ] **Validation:**
  - [ ] Zod schema for question submission (text length bounds, required field)

- [ ] **Testing:**
  - [ ] Unit test the keyword-filter matching against existing published questions
  - [ ] Unit test that the notify-admin/notify-customer hooks fire on the correct status transitions
  - [ ] Playwright e2e test: submit a question, confirm it does not appear publicly; seed a `Published` question+answer, confirm it renders correctly on the PDP

- [ ] **Documentation:**
  - [ ] Document the dev/seed workaround for publishing a Q&A pair without the moderation console
  - [ ] Document the `Question` status lifecycle and the notify-admin/notify-customer hook contracts so STORY-046 and STORY-032 implementers know what to plug into

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation + Global Layout)
- STORY-009 (Product Catalogue Data Model) — the products being asked about
- STORY-011 (Product Detail Page) — hosts the Q&A submit/list integration point
- STORY-046 (Q&A Moderation Console, Epic 07) — forward dependency for the admin answer/approve/publish workflow; questions will accumulate in `Pending` with no admin UI to act on them until STORY-046 ships
- STORY-032 (Notifications, Epic 05) — soft dependency for actual email/SMS/WhatsApp delivery of the notify-admin/notify-customer steps; this story ships with a logged/dev fallback until STORY-032 lands

## Out of Scope
- Admin answer/approve/publish workflow and console (STORY-046, Epic 07)
- Real notification delivery (email/SMS/WhatsApp) — this story only emits the hook (STORY-032, Epic 05)
- Recipe Q&A (a separate content type also mentioned in blueprint Section 7, belongs to Epic 04)

## References
- `docs/blueprint.md` Section 4 (Product Detail Page requirements list — Q&A)
- `docs/blueprint.md` Section 7 (Admin Console — Questions & Answers module workflow)
- `docs/blueprint.md` Section 9 item 3 (Product Platform)
