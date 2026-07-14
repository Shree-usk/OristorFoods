# STORY-028: Order Management

**Status:** Draft
**Epic:** 05 — Commerce Platform
**Priority:** High
**Persona(s):** Home Cook, Busy Professional, Sri Lankan Expat, Gourmet Food Enthusiast, Distributor

## User Story
As a customer who just placed an order, I want an order confirmation with a clear reference number and summary, so that I know my purchase succeeded and what to expect next.

As a customer waiting for my order, I want to see its current status (e.g. confirmed, processing, dispatched, delivered), so that I know where it is without having to contact support.

As a developer integrating with backend operations, I want a defined integration point where a confirmed order can trigger downstream ERP/warehouse processing, so that a real ERP system can be wired in later without redesigning order handling.

## Description
This story covers what happens once checkout (STORY-025) successfully creates an order: order confirmation, the customer-visible order-status pipeline, and a hook/integration point for triggering ERP sync. It corresponds to the "Order Confirmation → ERP Sync → Warehouse Processing → Shipment → Delivery" portion of the commerce lifecycle in `docs/blueprint.md` Section 5, and feeds the admin-side status pipeline described in Section 7 ("Orders — status pipeline (pending → dispatched → delivered → returned), invoices, packing slips, shipping labels, refunds"). Per Section 10, the ERP system being integrated with is unconfirmed — this story scopes ERP interaction to a well-defined integration-point/interface (an event or outbox-style hook fired on order-status changes) rather than a named ERP's API, mirroring how STORY-026 handles the payment-provider decision.

## Acceptance Criteria
- [ ] On successful checkout (STORY-025), an `Order` record is created capturing line items (with price-at-purchase snapshot), delivery address, resolved delivery zone/charge (STORY-027), applied coupon (STORY-029), payment reference (STORY-026), and reward points earned (STORY-030), with a human-readable order number/reference.
- [ ] The customer sees an order confirmation screen immediately after checkout showing the order number, item summary, delivery estimate, and total paid, and receives a transactional order-confirmation notification (STORY-032).
- [ ] Order status follows a defined pipeline visible to the customer: at minimum `Pending Confirmation → Confirmed → Processing → Dispatched → Delivered`, plus a `Cancelled` and a `Returned/Refunded` state reachable from the appropriate points in the pipeline — matching the admin pipeline named in blueprint Section 7 so admin and customer views stay in sync.
- [ ] A customer can view their order's current status and status history (timestamped) from an order-detail view; this story provides the underlying order data/API that STORY-036 (Order History & Support, Customer Platform epic) renders in the customer dashboard.
- [ ] Each order-status transition is validated (no illegal jumps, e.g. `Delivered` cannot move back to `Pending`) and recorded with a timestamp and the actor/source of the change (customer action, admin action, or system/integration event).
- [ ] An **order-integration hook** fires on defined order lifecycle events (e.g. `order.confirmed`, `order.cancelled`) that a downstream ERP/warehouse system could subscribe to — implemented as an internal event/outbox mechanism (e.g. a `OrderIntegrationEvent` table plus a documented interface), not a call to any named ERP's API, since the ERP system is unconfirmed per blueprint Section 10.
- [ ] The order-integration hook design explicitly supports a future "ERP sync status" field per order (matching the admin dashboard's "ERP sync status" indicator in blueprint Section 7), even though no real ERP writes to it yet in this story — a manual/mock sync-status update path exists for testing.
- [ ] Placing an order decrements/reserves stock (per STORY-009's inventory model) as part of the same transaction that creates the order (coordinated with STORY-025's atomic order-placement requirement) — an order is never created against stock that isn't actually available.
- [ ] Order cancellation (where still permitted by status, e.g. before `Dispatched`) is supported and triggers appropriate stock release and payment-refund initiation (via the STORY-026 `refund()` contract).
- [ ] All order data model fields needed by the admin Orders Console (STORY-047 — invoices, packing slips, shipping labels, refunds) are present in the schema this story defines, even though building that console itself is out of scope here.

## Tasks
- [ ] **Database:** Add `Order`, `OrderItem`, `OrderStatusHistory`, and `OrderIntegrationEvent` models to `prisma/schema.prisma`. `Order` includes status enum, totals breakdown (subtotal, delivery charge, discount, tax, grand total), delivery address snapshot, payment reference, coupon reference, reward-points-earned, and an `erpSyncStatus` field (nullable/pending by default). `OrderItem` snapshots product name/SKU/price at time of purchase (does not rely on live product data staying unchanged).
- [ ] **API:** `GET /api/orders/:id` — order detail for the owning customer (or admin).
- [ ] **API:** `GET /api/orders` — list orders for the authenticated customer (paginated), consumed by STORY-036.
- [ ] **API:** `POST /api/orders/:id/cancel` — customer-initiated cancellation, only valid pre-dispatch statuses.
- [ ] **API:** Internal (non-public) status-transition endpoint/service method usable by checkout, admin actions (STORY-047), and the mock ERP-sync test path.
- [ ] **Service/Backend:** `order.service.ts` — order creation (called from `checkout.service.ts`), status-transition validation (illegal-jump guard), cancellation logic (stock release + refund trigger), and integration-event emission.
- [ ] **Service/Backend:** `order.repository.ts` — the only place `Order`/`OrderItem`/`OrderStatusHistory`/`OrderIntegrationEvent` Prisma models are queried/mutated.
- [ ] **Service/Backend:** `order-integration.service.ts` defining the ERP-hook interface (e.g. `emitOrderEvent(type, orderId, payload)`) writing to `OrderIntegrationEvent` as an outbox, plus a mock/test consumer that flips `erpSyncStatus` to prove the hook works end to end without a real ERP.
- [ ] **Frontend:** Order confirmation page at `src/app/(storefront)/checkout/confirmation/[orderId]/page.tsx` (or equivalent route) showing order summary and reference number.
- [ ] **Frontend:** Order status/timeline display component (`src/components/storefront/orders/order-status-timeline.tsx`) reusable by both the confirmation page and STORY-036's order history view.
- [ ] **Validation:** Zod schema for cancellation requests and any admin/internal status-transition payloads (`src/validation/order.schema.ts`).
- [ ] **Testing:** Vitest unit tests for `order.service.ts` covering status-transition legality (allowed/blocked transitions), cancellation stock-release/refund-trigger behavior, and integration-event emission on `order.confirmed`/`order.cancelled`.
- [ ] **Testing:** Playwright e2e test covering: place order → see confirmation → view order status → cancel eligible order → status reflects cancellation.
- [ ] **Documentation:** Document the order-status pipeline (allowed transitions diagram/table) and the ERP integration-hook contract in `docs/architecture-decisions.md`, explicitly flagging that the real ERP system is unconfirmed per blueprint Section 10.

## Dependencies
- STORY-024 (Shopping Cart), STORY-025 (Checkout) — order creation is triggered at the end of checkout.
- STORY-026 (Payment Integration) — order records the payment reference and calls `refund()` on cancellation.
- STORY-027 (Shipping & Delivery Zone Pricing) — order snapshots the resolved delivery charge/zone.
- STORY-029 (Coupons & Promotions) — order snapshots applied coupon/discount.
- STORY-030 (Rewards / Loyalty Club) — order triggers reward-points award.
- STORY-032 (Notifications) — order confirmation and status-change notifications.
- STORY-009 (Product Catalogue Data Model) — inventory decrement/reservation on order placement.
- **Open external dependency (not blocking this story, but affects a future story):** the ERP system to integrate with is unconfirmed per blueprint Section 10; this story only builds the integration-point interface, not a real ERP adapter.

## Out of Scope
- Admin Orders Console (invoices, packing slips, shipping labels, admin-initiated refunds) — STORY-047.
- Customer-facing order history dashboard UI — STORY-036 (this story provides the underlying API/data it consumes).
- Real ERP system adapter — blocked pending Section 10 decision.
- Real courier/carrier tracking-number ingestion — depends on the unconfirmed shipping/carrier integrations (Section 10).

## References
- `docs/blueprint.md` Section 5 (Commerce lifecycle — Order Confirmation, ERP Sync, Warehouse Processing, Shipment, Delivery), Section 7 (Orders module, admin dashboard "ERP sync status"), Section 10 (Open Items — ERP system unconfirmed)
