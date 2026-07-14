# STORY-062: AI Recipe Assistant

**Status:** Draft
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
- [ ] A chat widget is available on `/recipes`, recipe detail pages, and a homepage entry point, supporting free-text conversational queries
- [ ] Customers can describe ingredients they already have (free text, multiple items) and receive `PUBLISHED` recipe suggestions ranked by ingredient overlap
- [ ] Customers can filter/refine by dietary restriction (using the existing `DietaryTag` taxonomy from STORY-017 — no duplicate taxonomy created) and by occasion (mapped to recipe categories/tags)
- [ ] For each suggested recipe, the assistant lists the Oristor products required, distinguishing products the customer has likely already purchased (using purchase-history signals shared with STORY-060) from products they still need to buy
- [ ] Customers can add missing products to their cart directly from the assistant's response without leaving the chat panel
- [ ] Conversation state persists within the session and supports multi-turn refinement (e.g. "shorter cook time," "no coconut milk") without losing prior context
- [ ] When no good match exists, the assistant asks a clarifying follow-up question instead of returning an empty or unhelpful response
- [ ] All recipe and product references in assistant responses are grounded via retrieval against the actual catalogue (reusing STORY-061's embeddings/search) — the assistant cannot reference a recipe or product ID that doesn't exist in the database
- [ ] The assistant clearly discloses that it is an AI assistant and provides a visible fallback link to browse the Recipe Centre manually
- [ ] Chat UI is accessible (live-region announcements for new messages, full keyboard operability) and mobile-responsive
- [ ] Conversation queries are logged (with clear privacy disclosure) to support QA and future improvement

## Tasks

- [ ] **Database:**
  - [ ] Define `RecipeAssistantConversation` model: `id`, `customerId` (nullable for guests), `sessionId`, `startedAt`, `lastMessageAt`
  - [ ] Define `RecipeAssistantMessage` model: `id`, `conversationId`, `role` (USER/ASSISTANT), `content`, `structuredPayload` (JSON — referenced recipe/product IDs and cart actions), `createdAt`
  - [ ] Confirm/extend the recipe ingredient data model (STORY-018) so each recipe ingredient line can optionally reference a Product SKU (`RecipeIngredient.productId`), enabling the product-gap analysis; add migration if the field doesn't already exist
  - [ ] Reuse `ProductEmbedding`/`ContentEmbedding` from STORY-061 — no separate embedding store for this feature

- [ ] **API:**
  - [ ] `POST /api/ai/recipe-assistant/message` — accepts a conversation ID (or creates one) and a user message, returns a streamed assistant response with structured recipe/product references
  - [ ] `GET /api/ai/recipe-assistant/conversations/[id]` — retrieves conversation history for the current session/customer
  - [ ] Endpoints call the Service Layer only and enforce that only `PUBLISHED` recipes/in-stock-aware products are ever surfaced

- [ ] **Service/Backend:**
  - [ ] `recipe-assistant.service.ts` orchestrating: intent parsing (ingredients-on-hand / dietary / occasion / refinement) → retrieval via `search.service.ts` (STORY-061) filtered accordingly → product-gap analysis cross-referencing `RecipeIngredient.productId` against the customer's purchase history (via `recommendation.repository.ts` or `order.service.ts`) → grounded response generation (RAG) → structured output (recipe cards, product cards, cart-add actions)
  - [ ] Guardrail layer that validates every recipe/product ID referenced in a generated response actually exists and is published/active before it is returned to the client
  - [ ] `recipe-assistant.repository.ts` for conversation/message persistence

- [ ] **Frontend:**
  - [ ] `src/components/storefront/ai/RecipeAssistantWidget.tsx` — chat panel with streaming message bubbles
  - [ ] Inline recipe-card and product-card renderers within chat messages, including an "Add to Cart" action per missing product
  - [ ] Typing/streaming indicator and multi-turn input box with conversation history scroll
  - [ ] "Browse Recipe Centre" fallback link always visible in the widget

- [ ] **Validation:**
  - [ ] Zod schemas for message payloads (length limits, rate limiting per session)
  - [ ] Basic content-moderation guard on user input before it reaches the LLM

- [ ] **Testing:**
  - [ ] Unit tests for ingredient-matching and product-gap-analysis logic
  - [ ] Integration test confirming the guardrail layer rejects/filters any hallucinated recipe or product reference
  - [ ] Playwright e2e: multi-turn conversation flow (ingredients → refinement → add-to-cart)
  - [ ] Accessibility test pass (axe) on the chat widget, including live-region message announcements

- [ ] **Documentation:**
  - [ ] Document the `RecipeIngredient.productId` linkage requirement so admin recipe authors (STORY-043) know to map ingredients to SKUs for the assistant to work correctly
  - [ ] Document the RAG grounding approach and the guardrail validation step for future maintainers

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
