# STORY-047: Admin Orders Console

**Status:** Done (core scope) — see `docs/architecture-decisions.md` 2026-10-01 entry for deviations from this doc's prose (real `OrderStatus` pipeline vs. the simplified sequence below, `ReturnRequest` extended instead of a new `ReturnRecord`, the `refundPayment` one-shot-refund constraint).
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** High
**Persona(s):** Sales Manager, Finance Manager, Warehouse Manager, Customer Support, Super Administrator

## User Story
As a Warehouse Manager, I want to move orders through pending → dispatched → delivered → returned and generate packing slips and shipping labels, so that fulfillment runs accurately and on schedule.
As a Finance Manager, I want to view invoices and process full or partial refunds directly from the order console, so that financial records stay accurate in one system.

## Description
This story delivers the Orders console module from `docs/blueprint.md` Section 7: "status pipeline (pending → dispatched → delivered → returned), invoices, packing slips, shipping labels, refunds." It is built on top of the `Order` data model from STORY-028 (Order Management) and surfaces shipping/zone context from STORY-055 (Delivery Zone Management). Refund processing depends on STORY-026 (Payment Integration), whose specific gateway provider is flagged as an unconfirmed open item per `docs/blueprint.md` Section 10 — refund logic must stay gateway-agnostic behind the payment Service layer.

## Acceptance Criteria
- [x] `/admin/orders` list view is filterable/searchable by status, date range, customer, payment status, and fulfillment status, with bulk status update on a selected set
- [x] Order detail view shows line items, pricing breakdown, customer info, shipping address with its resolved delivery zone (STORY-055), payment status, and a full status-change timeline — the zone/ETA fields were already on `Order` as a snapshot (STORY-036), satisfied without STORY-055 existing yet
- [x] Status pipeline is role-gated and cannot skip states except into Cancelled — using the real, already-shipped `order.service.ts::ALLOWED_TRANSITIONS` table (richer than this doc's simplified sequence: a distinct `Confirmed` state, `Returned` reachable from both `Dispatched` and `Delivered`) rather than a new, separate pipeline
- [x] Admin can generate/download an invoice PDF for any order
- [x] Admin can generate/download a packing slip PDF for warehouse picking
- [x] Admin can generate/download a shipping label in a carrier-agnostic placeholder format (actual carrier integration is an unconfirmed open item per blueprint Section 10)
- [x] Admin can process a full or partial refund against an order, capturing a reason and amount, with the order/payment status updated accordingly; refund logic is implemented behind `payment.service` so it is not hardcoded to a specific gateway (see architecture-decisions.md for the one-shot-refund constraint currently in `refundPayment`)
- [x] A return/RMA flow lets an admin mark an order (or specific line items) as returned with a reason code and an optional restock action
- [x] Every status change, refund, and return is recorded in the audit log

## Tasks
- [x] **Database:** `RefundRecord` (orderId, amount, reason, processedById, createdAt) and a `ReturnReasonCode` enum, extending the existing `ReturnRequest` (STORY-036) with `reasonCode`/`processedById`/`processedAt`/`restocked` rather than a new parallel `ReturnRecord` model — `OrderStatusHistory` already existed (STORY-028).
- [x] **API:** `/api/admin/orders` (list), `/api/admin/orders/[id]` (detail), `/api/admin/orders/[id]/status`, `/api/admin/orders/bulk-status`, `/api/admin/orders/[id]/invoice`, `/api/admin/orders/[id]/packing-slip`, `/api/admin/orders/[id]/shipping-label`, `/api/admin/orders/[id]/refund`, `/api/admin/orders/[id]/return`.
- [x] **Service/Backend:** `order-admin.service.ts` wrapping the real state machine, orchestrating PDF generation, and delegating refund execution to the gateway-agnostic `payment.service` (STORY-026).
- [x] **Frontend:** `src/app/(admin)/admin/orders/page.tsx` (list) and `[id]/page.tsx` (detail with status timeline, document download links, refund dialog, return/RMA dialog).
- [x] **Validation:** `order-admin.schema.ts` — refund amount (positive, order-level remaining-balance guard enforced in the service); bulk/single status schemas (illegal transitions rejected by the real state machine, not a separate guard).
- [x] **Testing:** `tests/unit/order-admin-service.test.ts` (state machine, permission gating, bulk update, refund guard, return/restock), `tests/unit/order-admin-pdf-services.test.ts` (PDF smoke tests), `tests/e2e/admin-orders.spec.ts` (full status walk + documents + refund; return with restock).
- [x] **Documentation:** `docs/architecture-decisions.md` 2026-10-01 entry covers the shipping-label placeholder scope and the `refundPayment` one-shot-refund constraint.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions
- STORY-028 (Order Management) — this console manages the order model that story defines
- STORY-026 (Payment Integration) — refund processing; note the specific gateway provider is unconfirmed per blueprint Section 10, so refund logic must remain gateway-agnostic
- STORY-055 (Delivery Zone Management) — zone/rate context displayed on the order

## References
- `docs/blueprint.md` Section 7 ("Orders" console module bullet)
- `docs/blueprint.md` Section 10 (payment gateway and shipping carrier — unconfirmed open items)
