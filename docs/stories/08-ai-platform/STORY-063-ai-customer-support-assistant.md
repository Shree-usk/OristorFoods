# STORY-063: AI Customer Support Assistant

**Status:** Done — see `docs/architecture-decisions.md` 2026-10-04 entry for the full write-up and scope decisions.

**Epic:** 08 — AI Platform
**Priority:** Medium
**Persona(s):** Home Cook, Busy Professional, Sri Lankan Expat, Gourmet Food Enthusiast

## User Story
As a customer, I want to ask an AI assistant about my order status, so that I get an instant answer without waiting for human support.
As a customer, I want to ask common product questions (ingredients, allergens, stock availability), so that I can get quick answers grounded in accurate product data.
As a customer, I want to understand the return/refund policy through a quick chat, so that I don't have to search through help pages.
As a customer, I want the assistant to hand me off to a real support agent when it can't resolve my issue, so that I'm never stuck in a dead-end conversation.

## Description
This story delivers an AI chat assistant for common customer-support queries — order status, product questions, and returns/refund policy — as described in `docs/blueprint.md` Section 5 ("AI features: customer support assistant") and Section 9 item 8 ("AI Platform"). It is available sitewide via a persistent chat launcher and within the Customer Portal, and it escalates to human support when it cannot confidently resolve a query, creating a ticket in the Order History & Support flow delivered by STORY-036. The assistant is strictly grounded in verified data (the customer's own orders, the product catalogue, and canonical policy content) — it must never fabricate order numbers, tracking information, refund promises, or policy exceptions.

## Acceptance Criteria
- [x] A persistent chat widget/launcher is available sitewide and within the Customer Portal — mounted once in `(storefront)/layout.tsx`; `/account/*` (the Customer Portal) lives under that same route group, so it's covered automatically
- [x] Authenticated customers can ask about their own order status; the assistant looks up and reports only that customer's own orders (strict auth-scoping, no cross-customer data access under any phrasing of the query) — see Scope Decisions for the input-side security design and its dedicated test coverage
- [x] Guest (unauthenticated) users can ask general product/policy questions; when a query requires order-specific data, the assistant prompts sign-in rather than guessing or refusing silently
- [x] The assistant answers product questions (ingredients, allergens, nutrition, stock availability) grounded in live product catalogue data (STORY-009), not freeform generation — reuses `product.repository.ts::findProductsForCompareByIds`
- [x] The assistant explains return/refund/exchange policy using a single canonical policy content source (not ad hoc generated text) — the new admin-managed `PolicyDocument` model, ships with no seeded content (see Scope Decisions)
- [x] The assistant detects when it cannot confidently resolve a query (low confidence, sensitive topic, or an explicit customer request for a human) and creates an escalation ticket in the human support queue (STORY-036), pre-filled with the conversation transcript and relevant context
- [x] Escalated conversations appear in the customer's Order History & Support view (STORY-036) with status visibility — satisfied for free: a real `SupportTicket` row created via the existing `createTicket()` already shows up in `/account/support`'s existing list, no new UI needed
- [x] The assistant never fabricates order numbers, tracking links, refund amounts, or policy exceptions — all such data must come from a verified lookup, and the assistant declines rather than guesses when data isn't available
- [x] The chat widget always displays clear "AI assistant" labeling and a visible "talk to a human" escalation path
- [~] Conversation transcripts are stored for audit/QA, **with a privacy disclosure shown to the user** (done — the widget states conversations are saved and may be reviewed) **but no documented data-retention policy** — no retention/automated-purge mechanism exists anywhere in this codebase for any model today (not just this one), and building one would be a materially separate piece of scope; honestly left unchecked rather than claimed solved. See Scope Decisions.
- [x] The assistant endpoint enforces rate limiting/abuse protection — reuses the existing `rate-limit.ts`, on both the message and explicit-escalation endpoints
- [x] Chat UI is accessible (WCAG 2.1 AA) and mobile-responsive — axe-clean; a real `aria-dialog-name` gap STORY-062 hit was avoided proactively here by giving `DialogContent` an `aria-label` from the start

## Scope Decisions

- **The security guarantee comes from controlling the LLM's INPUT, not filtering its output.** A guest's prompt never contains any order data at all — structurally absent, not just "instructed not to mention." An authenticated customer's prompt only ever contains that customer's own orders, fetched through the already ownership-scoped `order.service.ts::listOrdersForUser`/`getOrderForConfirmation`. The model cannot leak another customer's data because it was never given any. As defense in depth, the structured output's `referencedOrderNumbers` is guardrail-filtered to the real order numbers actually fetched that turn, mirroring STORY-062's `recommendedRecipeIds` guardrail exactly.
- **A hard identity-exclusivity invariant**, copied from STORY-062's own route: `customerId` comes only from `auth()`, never client input; `sessionId` is set only when there's no `customerId`. The service's conversation-ownership check additionally rejects outright (no OR-fallback) any sessionId-only match against a conversation that already has a non-null `customerId` — explicit defense-in-depth beyond the route invariant alone, and directly tested.
- **A guest conversation is never "upgraded" in place.** Signing in mid-conversation starts a new conversation bound to the customer id (enforced client-side too — `use-support-assistant.ts` clears the stored conversation id on a signed-out→signed-in transition).
- **No token streaming** — same reasoning as STORY-062: "never fabricate order numbers, tracking, refund amounts" is incompatible with showing unvalidated tokens.
- **Reuses STORY-062's chat infrastructure directly, not duplicated**: `ChatCompletionProvider`/`OpenAiChatProvider` and `isFlaggedByModeration` are both already generic (not recipe-specific) and imported as-is.
- **No guest escalation/ticket capability was built.** `SupportTicket.userId` is non-null everywhere in this codebase; adding guest-ticket support would be a materially bigger change to STORY-036's already-shipped model than this story should make. A guest who wants a human is prompted to sign in, the same treatment already specified for guest order-specific queries.
- **`PolicyDocument` ships with no seeded content** — no real returns/refund/exchange policy text exists anywhere in this codebase to seed it with, and inventing one would be fabrication, the same standard STORY-061's empty glossary set.
- **`SupportTicketSource` is a new, separate enum field on `SupportTicket`, not an overload of the existing `category` enum** — `category` (OrderIssue/Product/Delivery/Billing/Other) is an orthogonal topic axis already used for triage dashboards; the assistant's structured output includes its own best-guess `escalationCategory` so an AI-created ticket still carries a real topic, not a blanket "Other."
- **No documented data-retention policy for conversation transcripts** — see the honestly-unchecked AC above. No retention/purge mechanism exists anywhere in this codebase for any model yet; building one is out of this story's scope, not silently skipped.
- **`PolicyDocument` admin CRUD lives under the existing System Settings console** (`AdminModule.SystemSettings`, a new 10th tab), not a new admin module — mirrors `system-settings.service.ts`'s own permission-gated, audit-logged per-category function shape.

## Tasks

- [x] **Database:**
  - [x] Define `SupportAssistantConversation` model: `id`, `customerId` (nullable for guests), `sessionId`, `startedAt`, `lastMessageAt`, `escalated` (boolean)
  - [x] Define `SupportAssistantMessage` model: `id`, `conversationId`, `role` (User/Assistant), `content`, `structuredPayload` (JSON), `confidenceScore`, `promptTokens`/`completionTokens`, `createdAt`
  - [x] Added `SupportTicketSource` (Customer/AiAssistant, additive, default `Customer`) and `conversationId` to the existing `SupportTicket` model — no existing caller needed to change
  - [x] Defined `PolicyDocument`: `id`, `slug` (unique, free-string), `title`, `content`, `updatedById`, timestamps

- [x] **API:**
  - [x] `POST /api/ai/support-assistant/message` — auth-aware (customerId from `auth()` only), rate-limited; returns the complete, guardrail-validated response (no streaming — see Scope Decisions)
  - [x] `POST /api/ai/support-assistant/escalate` — the widget's explicit "Talk to a human" button; creates a support ticket via STORY-036's existing `createTicket()`
  - [x] `GET /api/ai/support-assistant/conversations/[id]` — ownership-checked
  - [x] Order lookups are always scoped to the `auth()`-derived customerId, never client input

- [x] **Service/Backend:**
  - [x] `support-assistant.service.ts`: strict ownership check, moderation, grounding retrieval (own orders if signed in, product candidates via STORY-061's existing retrieval, the real `PolicyDocument` content), one structured-output LLM call, guardrail validation, escalation
  - [x] Escalation calls the existing `support-ticket.service.ts::createTicket` — no duplicated ticket-creation logic
  - [x] Guardrail: `referencedOrderNumbers` filtered to the real, ownership-scoped order data fetched that turn before anything is returned or persisted

- [x] **Frontend:**
  - [x] `support-assistant-widget.tsx` + `support-assistant-launcher.tsx`, mounted sitewide in `(storefront)/layout.tsx`
  - [x] Inline sign-in prompt (links to `/account/login`) when `requiresSignIn` comes back
  - [x] Escalation confirmation showing a link to `/account/support`
  - [x] Persistent "AI assistant"/privacy disclosure and "Talk to a human" button always visible in the widget header

- [x] **Validation:**
  - [x] Zod schemas for message/escalation payloads (`support-assistant.schema.ts`)
  - [x] customerId is derived from the session server-side only, never accepted from the client — the real enforcement, not a separate "middleware" layer
  - [x] Rate limiting via the existing `rate-limit.ts`, on both the message and escalate endpoints

- [x] **Testing:**
  - [x] Security-focused unit tests: a guest's order-related message never puts any order data in the LLM prompt; a crafted message naming another customer's real order number is silently excluded (not confirmed/denied — avoids an enumeration oracle); the ownership check rejects a sessionId-only match against a customer-owned conversation
  - [x] Guardrail test: a hallucinated order number outside the real set is stripped
  - [x] Escalation creates a real `SupportTicket` with `source: "AiAssistant"` and the right category
  - [x] Moderation short-circuit and graceful-fallback-on-failure tests
  - [x] `policy-document-service.test.ts`: CRUD + permission gating
  - [x] Playwright e2e: launcher visible sitewide, widget open/send/fallback flow, "Talk to a human" always visible, keyboard operability, axe pass

- [x] **Documentation:**
  - [x] This file's Scope Decisions section documents the security design and escalation approach
  - [x] `docs/architecture-decisions.md` records the full reasoning, including a real `OrderForbiddenError`-vs-`OrderNotFoundError` bug caught by the test suite and fixed before shipping
  - [x] No incident runbook was written — out of scope for this pass; flagged as a follow-up

## Dependencies
- STORY-036 (Order History & Support) — escalation target; this story creates tickets in that flow and reads its status back
- STORY-028 (Order Management) — source of order-status data for authenticated lookups
- STORY-009 (Product Catalogue Data Model) — source of product Q&A grounding data
- STORY-034 (Profile, Addresses & Account Settings) — authentication/session context
- STORY-054 (System Settings) — likely home for `PolicyDocument` / policy content management

## Out of Scope
- Fully automated refund/return processing without human approval
- Phone or voice-based support
- Conversation in languages other than English (future phase)
- Distributor/export-specific support workflows (distinct from consumer support)

## References
- `docs/blueprint.md` Section 5 (AI features: customer support assistant)
- `docs/blueprint.md` Section 9 item 8 (AI Platform)
- `docs/folder-structure.md` (`src/services/`, `src/repositories/`, `src/components/storefront/`)
