# STORY-047: Admin Orders Console

**Status:** Draft
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** High
**Persona(s):** Sales Manager, Finance Manager, Warehouse Manager, Customer Support, Super Administrator

## User Story
As a Warehouse Manager, I want to move orders through pending → dispatched → delivered → returned and generate packing slips and shipping labels, so that fulfillment runs accurately and on schedule.
As a Finance Manager, I want to view invoices and process full or partial refunds directly from the order console, so that financial records stay accurate in one system.

## Description
This story delivers the Orders console module from `docs/blueprint.md` Section 7: "status pipeline (pending → dispatched → delivered → returned), invoices, packing slips, shipping labels, refunds." It is built on top of the `Order` data model from STORY-028 (Order Management) and surfaces shipping/zone context from STORY-055 (Delivery Zone Management). Refund processing depends on STORY-026 (Payment Integration), whose specific gateway provider is flagged as an unconfirmed open item per `docs/blueprint.md` Section 10 — refund logic must stay gateway-agnostic behind the payment Service layer.

## Acceptance Criteria
- [ ] `/admin/orders` list view is filterable/searchable by status, date range, customer, payment status, and fulfillment status, with bulk status update on a selected set
- [ ] Order detail view shows line items, pricing breakdown, customer info, shipping address with its resolved delivery zone (STORY-055), payment status, and a full status-change timeline
- [ ] Status pipeline is a fixed sequence — Pending → Processing → Dispatched → Delivered → Returned — plus a Cancelled side-state; every transition is role-gated and cannot skip states except into Cancelled
- [ ] Admin can generate/download an invoice PDF for any order
- [ ] Admin can generate/download a packing slip PDF for warehouse picking
- [ ] Admin can generate/download or print a shipping label in a carrier-agnostic placeholder format (actual carrier integration is an unconfirmed open item per blueprint Section 10)
- [ ] Admin can process a full or partial refund against an order, capturing a reason and amount, with the order/payment status updated accordingly; refund logic is implemented behind `payment.service` so it is not hardcoded to a specific gateway
- [ ] A return/RMA flow lets an admin mark an order (or specific line items) as returned with a reason code and an optional restock action
- [ ] Every status change, document generation, and refund is recorded in the audit log (STORY-057)

## Tasks
- [ ] **Database:** Extend the `Order` model (STORY-028) with a `statusHistory` relation, `RefundRecord` (orderId, amount, reason, processedById, createdAt), and `ReturnRecord` (orderId, lineItems, reasonCode, restocked boolean).
- [ ] **API:** `/api/admin/orders` (list/detail), `/api/admin/orders/[id]/status`, `/api/admin/orders/[id]/invoice`, `/api/admin/orders/[id]/packing-slip`, `/api/admin/orders/[id]/shipping-label`, `/api/admin/orders/[id]/refund`, `/api/admin/orders/[id]/return`.
- [ ] **Service/Backend:** `order-admin.service.ts` enforcing the fixed status state machine, orchestrating PDF generation, and delegating refund execution to the gateway-agnostic `payment.service` (STORY-026).
- [ ] **Frontend:** `src/app/(admin)/orders/page.tsx` (list) and `[id]/page.tsx` (detail with status timeline, document download buttons, refund modal, return/RMA modal).
- [ ] **Validation:** Zod schema for refund amount (cannot exceed order total minus prior refunds already issued); status-transition guard rejecting any out-of-sequence transition other than Cancelled.
- [ ] **Testing:** Unit tests for the status state machine and the refund-amount guard; e2e test a full Pending → Dispatched → Delivered flow; e2e test a partial refund and confirm the order balance updates correctly.
- [ ] **Documentation:** Note that the shipping label format is a generic placeholder pending carrier confirmation (blueprint Section 10) and that payment gateway specifics are unconfirmed — document the gateway-agnostic refund contract other stories should follow.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions
- STORY-028 (Order Management) — this console manages the order model that story defines
- STORY-026 (Payment Integration) — refund processing; note the specific gateway provider is unconfirmed per blueprint Section 10, so refund logic must remain gateway-agnostic
- STORY-055 (Delivery Zone Management) — zone/rate context displayed on the order

## References
- `docs/blueprint.md` Section 7 ("Orders" console module bullet)
- `docs/blueprint.md` Section 10 (payment gateway and shipping carrier — unconfirmed open items)
