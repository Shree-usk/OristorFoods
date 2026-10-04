# STORY-062: AI Recipe Assistant

**Status:** Done — see `docs/architecture-decisions.md` 2026-10-04 entry for the full write-up and scope decisions.

**Epic:** 08 — AI Platform
**Priority:** Medium
**Persona(s):** Home Cook, Busy Professional, Sri Lankan Expat, Gourmet Food Enthusiast

## User Story
As a Home Cook, I want to tell an assistant what ingredients I already have, so that it can suggest Oristor recipes I can cook and tell me which products I still need to buy.
As a Busy Professional, I want to ask for quick weeknight dinner ideas within a time budget, so that I get a realistic recipe plus a ready-made shopping list.
As a Sri Lankan Expat, I want to ask for recipes for a specific occasion (e.g. Avurudu) or dietary restriction, so that I get relevant, authentic suggestions without browsing the whole Recipe Centre.
As a Gourmet Food Enthusiast, I want to refine suggestions conversationally ("make it spicier," "something shorter"), so that I don't have to restart my search from scratch.

## Description
This story delivers a conversational Recipe Assistant, called out in `docs/blueprint.md` Section 5 ("AI features: recipe assistant") and Section 9 item 8 ("AI Platform"), that helps customers discover recipes by ingredients on hand, dietary restriction, or occasion, and identifies which Oristor products they need to buy to make them. It is a retrieval-augmented chat experience built on top of the Recipe Centre data model (STORY-017), recipe detail/ingredient data (STORY-018), and the semantic retrieval layer from STORY-061, and it integrates directly with the Shopping Cart (STORY-024) so customers can act on suggestions immediately. All responses are grounded in Oristor's actual catalogue — the assistant must never invent recipes or products that don't exist in the system.

## Acceptance Criteria
- [x] A chat widget is available on `/recipes`, recipe detail pages, and a homepage entry point, supporting free-text conversational queries
- [x] Customers can describe ingredients they already have (free text, multiple items) and receive `PUBLISHED` recipe suggestions ranked by ingredient overlap — via real keyword+semantic retrieval (reusing STORY-061) feeding a grounded LLM selection, not a literal overlap-count score
- [x] Customers can filter/refine by dietary restriction (using the existing `DietaryTag` taxonomy from STORY-017 — no duplicate taxonomy created) and by occasion (mapped to recipe categories/tags)
- [x] For each suggested recipe, the assistant lists the Oristor products required, distinguishing products the customer has likely already purchased (using purchase-history signals shared with STORY-060) from products they still need to buy
- [x] Customers can add missing products to their cart directly from the assistant's response without leaving the chat panel
- [x] Conversation state persists within the session and supports multi-turn refinement (e.g. "shorter cook time," "no coconut milk") without losing prior context
- [x] When no good match exists, the assistant asks a clarifying follow-up question instead of returning an empty or unhelpful response — enforced by the structured-output schema and system prompt
- [x] All recipe and product references in assistant responses are grounded via retrieval against the actual catalogue (reusing STORY-061's embeddings/search) — the assistant cannot reference a recipe or product ID that doesn't exist in the database
- [x] The assistant clearly discloses that it is an AI assistant and provides a visible fallback link to browse the Recipe Centre manually
- [x] Chat UI is accessible (live-region announcements for new messages, full keyboard operability) and mobile-responsive
- [x] Conversation queries are logged (with clear privacy disclosure) to support QA and future improvement

## Scope Decisions

- **No token-by-token streaming, despite the task list's "streamed response"/"streaming indicator" wording.** AC #8 is a hard grounding guarantee — the assistant can never reference a recipe/product id that doesn't exist. Real token streaming is structurally incompatible with that: you cannot validate-before-show if tokens are already on screen. Retrieval runs deterministically first against real catalogue data; the LLM is constrained to a JSON schema that can only select from the candidate ids it was given; a guardrail re-verifies every returned id (and re-checks `Published` status, closing the retrieval→generation race) before the response ever leaves the service layer. The widget shows a "Thinking…" indicator while the request is in flight, then renders the complete, validated message — meeting the UX intent without undermining the grounding guarantee.
- **No shared "AI Gateway" is built in this story either.** STORY-061's own architecture review recommended a shared chat/completion provider layer (model selection, spend cap, token logging, rate limiting) "before or alongside" this story. The user was asked directly whether that still applied and confirmed yes in spirit, but explicitly said not to build it now. This story's `ChatCompletionProvider` interface is the same kind of narrow, swappable interface STORY-061's `EmbeddingProvider` was — scoped to this story's own structured-output need, not a cross-story abstraction.
- **Model: `gpt-4o-mini`.** Cost-appropriate for a structured-output RAG task at conversational volume; not raised as a blocking question since the provider (OpenAI) was already confirmed in STORY-061.
- **Content moderation fails open.** No automated moderation precedent existed anywhere in this codebase (every `*moderation*` service here is a human-review admin workflow). A real call to OpenAI's own `/v1/moderations` endpoint runs before a message is used for anything; on a transient moderation-API error it logs and lets the message through rather than blocking all chat — the output-side grounding guardrail is the harder safety boundary either way.
- **`RecipeIngredient.productId` already existed** before this story — STORY-061 (or an earlier pass) had already added it; no migration was needed for the product-gap linkage itself.
- **Purchase history (`getPurchasedProductIds`) was added to `recommendation.repository.ts`**, not a new file — mirrors that file's own existing `getBestSellingProductIds`'s OrderItem-direct, Cancelled-excluded query shape, per its header comment's stated convention.
- **Guest-to-customer conversation migration on login is out of scope.** A conversation started anonymously (via the shared `rec_sid` cookie) is not re-attached to a customer who logs in mid-conversation.

## Tasks

- [x] **Database:**
  - [x] Define `RecipeAssistantConversation` model: `id`, `customerId` (nullable for guests), `sessionId`, `startedAt`, `lastMessageAt`
  - [x] Define `RecipeAssistantMessage` model: `id`, `conversationId`, `role` (User/Assistant), `content`, `structuredPayload` (JSON), `promptTokens`/`completionTokens`, `createdAt`
  - [x] `RecipeIngredient.productId` already existed — no migration needed (see Scope Decisions)
  - [x] Reuse `ProductEmbedding`/`ContentEmbedding` from STORY-061 — no separate embedding store for this feature

- [x] **API:**
  - [x] `POST /api/ai/recipe-assistant/message` — accepts a conversation ID (or creates one) and a user message, returns the complete, guardrail-validated assistant response with structured recipe/product references (no streaming — see Scope Decisions)
  - [x] `GET /api/ai/recipe-assistant/conversations/[id]` — retrieves conversation history for the current session/customer, ownership-checked (404 if not owned)
  - [x] Endpoints call the Service Layer only and enforce that only `PUBLISHED` recipes are ever surfaced

- [x] **Service/Backend:**
  - [x] `recipe-assistant.service.ts` orchestrating: moderation check → retrieval (keyword `buildRecipeWhere` + semantic `findSimilarContentIds`, reusing STORY-061) → product-gap analysis cross-referencing `RecipeIngredient.productId` against `getPurchasedProductIds` → grounded structured-output generation → guardrail validation
  - [x] Guardrail layer that validates every recipe ID referenced in a generated response actually exists in the candidate set and is still Published before it is returned to the client
  - [x] `recipe-assistant.repository.ts` for conversation/message persistence

- [x] **Frontend:**
  - [x] `recipe-assistant-widget.tsx` — chat panel with message bubbles (no streaming, see Scope Decisions)
  - [x] Inline recipe-card renderers within chat messages, with a real "Add to Cart" action per missing product (reuses the existing `useCart()` hook/`/api/cart/items`)
  - [x] "Thinking…" indicator and multi-turn input box with conversation history
  - [x] "Browse Recipe Centre" fallback link always visible, plus an explicit AI-assistant/privacy disclosure line

- [x] **Validation:**
  - [x] Zod schema for message payloads (length limit, mirrors `question.schema.ts`'s precedent) + rate limiting per session via the existing `rate-limit.ts`
  - [x] Content-moderation guard on user input before it reaches the LLM (real OpenAI moderation call, fails open — see Scope Decisions)

- [x] **Testing:**
  - [x] Unit tests for product-gap-analysis logic (owned vs needed, guest has none)
  - [x] Unit test confirming the guardrail strips a hallucinated recipe id a fake provider returned
  - [x] Unit tests for the moderation short-circuit and the graceful-fallback-on-provider-failure path
  - [x] Playwright e2e: open the widget, send a message, confirm the real fallback response renders (this environment has no OpenAI credits — same honest standard as STORY-061); keyboard operability; axe pass

- [x] **Documentation:**
  - [x] This file's Scope Decisions section documents the `RecipeIngredient.productId` linkage (already existed) and the guardrail/grounding approach
  - [x] `docs/architecture-decisions.md` records the no-streaming decision and the explicit override of STORY-061's "build a shared gateway first" recommendation

## Dependencies
- STORY-017 (Recipe Centre & Listing) — recipe data model, categories, and dietary tags this assistant queries
- STORY-018 (Recipe Detail Page) — recipe ingredient data and the SKU linkage the product-gap analysis relies on
- STORY-009 (Product Catalogue Data Model) — product data referenced in responses
- STORY-024 (Shopping Cart) — target of the in-chat "Add to Cart" action
- STORY-061 (AI Smart Search) — shared embeddings/retrieval layer this assistant is built on
- STORY-060 (AI Product Recommendations) — purchase-history signal reused for the "already own" vs. "needs to buy" distinction

## Out of Scope
- Voice interaction
- Meal-planning calendars or subscription meal kits
- Conversation in languages other than English (future phase)
- Live handoff to a human chef or cooking expert (distinct from the support escalation in STORY-063)

## References
- `docs/blueprint.md` Section 5 (AI features: recipe assistant)
- `docs/blueprint.md` Section 9 item 8 (AI Platform)
- `docs/folder-structure.md` (`src/services/`, `src/repositories/`, `src/components/storefront/`)
