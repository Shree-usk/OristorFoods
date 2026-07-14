# STORY-063: AI Customer Support Assistant

**Status:** Draft
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
- [ ] A persistent chat widget/launcher is available sitewide and within the Customer Portal
- [ ] Authenticated customers can ask about their own order status; the assistant looks up and reports only that customer's own orders (strict auth-scoping, no cross-customer data access under any phrasing of the query)
- [ ] Guest (unauthenticated) users can ask general product/policy questions; when a query requires order-specific data, the assistant prompts sign-in rather than guessing or refusing silently
- [ ] The assistant answers product questions (ingredients, allergens, nutrition, stock availability) grounded in live product catalogue data (STORY-009), not freeform generation
- [ ] The assistant explains return/refund/exchange policy using a single canonical policy content source (not ad hoc generated text), so policy answers stay consistent with what's published on the site
- [ ] The assistant detects when it cannot confidently resolve a query (low confidence, sensitive topic, or an explicit customer request for a human) and creates an escalation ticket in the human support queue (STORY-036), pre-filled with the conversation transcript and relevant context
- [ ] Escalated conversations appear in the customer's Order History & Support view (STORY-036) with status visibility
- [ ] The assistant never fabricates order numbers, tracking links, refund amounts, or policy exceptions — all such data must come from a verified lookup, and the assistant declines rather than guesses when data isn't available
- [ ] The chat widget always displays clear "AI assistant" labeling and a visible "talk to a human" escalation path
- [ ] Conversation transcripts are stored for audit/QA with a documented data-retention policy and a privacy disclosure shown to the user
- [ ] The assistant endpoint enforces rate limiting/abuse protection
- [ ] Chat UI is accessible (WCAG 2.1 AA) and mobile-responsive

## Tasks

- [ ] **Database:**
  - [ ] Define `SupportAssistantConversation` model: `id`, `customerId` (nullable for guests), `sessionId`, `startedAt`, `lastMessageAt`, `escalated` (boolean)
  - [ ] Define `SupportAssistantMessage` model: `id`, `conversationId`, `role` (USER/ASSISTANT/SYSTEM), `content`, `intent` (enum: ORDER_STATUS/PRODUCT_QUESTION/POLICY/OTHER), `confidenceScore`, `createdAt`
  - [ ] Add an `AI_ESCALATED` source/origin field (or equivalent) to the support ticket model owned by STORY-036, plus a foreign key linking the escalation back to `SupportAssistantConversation`
  - [ ] Define/confirm a `PolicyDocument` content model (or CMS reference) as the single canonical source for return/refund/exchange policy text used for grounding

- [ ] **API:**
  - [ ] `POST /api/ai/support-assistant/message` — auth-aware, streamed response; requires an authenticated session for order-status intents
  - [ ] `POST /api/ai/support-assistant/escalate` — creates a support ticket (via STORY-036's support service) pre-filled with the transcript
  - [ ] Endpoints call the Service Layer only; order lookups are always scoped to `session.customerId`, never a customer ID supplied by the client

- [ ] **Service/Backend:**
  - [ ] `support-assistant.service.ts`: intent classification (order status / product question / policy / other), authenticated order lookup via `order.service.ts` (STORY-028), grounded policy retrieval from `PolicyDocument`, confidence scoring, and escalation-trigger logic
  - [ ] Escalation flow calls into the STORY-036 support-ticket service rather than duplicating ticket-creation logic
  - [ ] PII redaction step applied before conversation content is written to logs
  - [ ] Guardrail layer that blocks any response referencing order/tracking/refund data not returned by a verified lookup call

- [ ] **Frontend:**
  - [ ] `src/components/storefront/ai/SupportAssistantWidget.tsx` — persistent launcher + chat panel, available sitewide via the shared layout (STORY-003)
  - [ ] Inline sign-in prompt flow when an order-specific query is asked by a guest
  - [ ] Escalation confirmation UI showing the created ticket reference and a link into Order History & Support (STORY-036)
  - [ ] Persistent "AI assistant" label and "talk to a human" button always visible in the widget header

- [ ] **Validation:**
  - [ ] Zod schemas for message and escalation payloads
  - [ ] Auth-guard middleware enforcing that order-lookup intents require a valid session and only ever resolve against `session.customerId`
  - [ ] Rate limiting on the message endpoint per session/IP

- [ ] **Testing:**
  - [ ] Unit tests for intent classification and escalation-trigger thresholds
  - [ ] Security-focused integration test verifying a customer cannot retrieve another customer's order data via prompt injection or crafted input
  - [ ] Integration test confirming the guardrail layer blocks unverified order/refund claims
  - [ ] Playwright e2e: full escalation flow from chat message through ticket creation and visibility in STORY-036's support view
  - [ ] Accessibility test pass (axe) on the chat widget

- [ ] **Documentation:**
  - [ ] Document escalation criteria and confidence thresholds
  - [ ] Document the canonical policy-content ownership (who in the Admin console maintains `PolicyDocument` and how updates propagate)
  - [ ] Write an incident runbook for the case where the assistant gives incorrect information (how to identify, disable, and correct)

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
