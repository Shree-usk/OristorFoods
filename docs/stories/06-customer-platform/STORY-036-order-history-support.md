# STORY-036: Order History & Support

**Status:** Draft
**Epic:** 06 — Customer Platform
**Priority:** Medium
**Persona(s):** Home Cook, Busy Professional, Sri Lankan Expat, Gourmet Food Enthusiast, Distributor

## User Story
As a customer, I want to view a list of my past orders and their current status, so that I know what I've bought and when to expect delivery.

As a customer, I want to open an order and see its full detail — items, address, payment summary, and delivery tracking — so that I have everything I need in one place without contacting support.

As a Busy Professional, I want to reorder a past purchase in one click, so that restocking staples doesn't take extra effort.

As a customer, I want to request a return on a delivered order or contact support about an issue, so that problems get resolved without hunting for a phone number or email address.

## Description
This story builds the customer-facing order history and support experience on top of the Order model and status pipeline owned by STORY-028 (Order Management). It adds `/account/orders` (list), `/account/orders/[id]` (detail/tracking), and `/account/support` (contact/ticket) under the account shell from STORY-033. Maps to `docs/blueprint.md` Section 5 (customer management), Section 7 (admin Orders module status pipeline this story's tracker mirrors), and Section 9 item 6.

## Acceptance Criteria
- [ ] Order list is paginated, filterable by status (Pending/Processing/Dispatched/Delivered/Returned/Cancelled) and date range, sorted most-recent-first
- [ ] Each order card shows order number, order date, item thumbnails, order total, a status badge, and "View Details" / "Reorder" actions
- [ ] Order detail page shows line items (product, quantity, unit price, image), the shipping address used, a payment summary, and a status timeline that mirrors STORY-028's pipeline stages
- [ ] Order detail page shows carrier/tracking number and a tracking link once the order is dispatched, and offers an invoice/packing-slip PDF download
- [ ] "Reorder" adds all still-in-stock items from the past order to the cart in one action; any out-of-stock items are flagged and skipped with an explanatory message rather than blocking the whole reorder
- [ ] A return/refund request can be initiated from a delivered order's detail page (reason, affected items, quantities); the request is visible to the admin Orders console for processing
- [ ] Support page presents a contact form with a subject category (incl. "Order Issue"), message body, and an optional order reference — arriving pre-filled with the order number when launched from an order's "Contact Support" link
- [ ] Submitting the support form creates a ticket the customer can subsequently see in a ticket history list on the same page, with status (Open/In Progress/Resolved/Closed)
- [ ] All order and ticket data is fetched through services (`order.service.ts` from STORY-028, this story's own `support-ticket.service.ts`); no direct Prisma access from account pages or route handlers
- [ ] Zero-orders state shows a "Browse Products" CTA instead of an empty table
- [ ] Order list/detail is responsive: card layout on mobile, table/detail layout on desktop, verified at 375px–1440px

## Tasks
- [ ] **Database:** `SupportTicket` model (`userId`, `orderId?`, `category`, `subject`, `message`, `status` enum `[OPEN, IN_PROGRESS, RESOLVED, CLOSED]`, `createdAt`, `updatedAt`) and `TicketMessage` model for threaded replies; `ReturnRequest` model (`orderId`, `items` [productId, quantity], `reason`, `status` enum `[REQUESTED, APPROVED, REJECTED, COMPLETED]`, `createdAt`). If STORY-028's `Order` model does not yet expose a return/refund workflow, treat `ReturnRequest` as an extension of that model owned jointly with STORY-028, not a competing table.
- [ ] **API:** `GET /api/account/orders` (paginated/filtered), `GET /api/account/orders/[id]`, `POST /api/account/orders/[id]/reorder`, `POST /api/account/orders/[id]/return-request`, `GET /api/account/orders/[id]/invoice` (PDF), `GET/POST /api/account/support/tickets`, `GET /api/account/support/tickets/[id]`.
- [ ] **Service:** `customer-order-history.service.ts` (thin wrapper over `order.service.ts` from STORY-028, scoped to the authenticated customer's own orders — must never allow fetching another customer's order by id); `support-ticket.service.ts`; `invoice-pdf.service.ts` (reuse STORY-028's invoice generation if it already exists rather than duplicating it).
- [ ] **Frontend:** `src/app/(storefront)/account/orders/page.tsx`, `account/orders/[id]/page.tsx`, `account/support/page.tsx`; `OrderListItem`, `OrderStatusTimeline`, `ReturnRequestDialog`, `SupportTicketForm`, `TicketHistoryList` under `src/components/storefront/account/`.
- [ ] **Validation:** `src/validation/account/return-request.schema.ts`, `support-ticket.schema.ts`.
- [ ] **Testing:** Vitest unit test for reorder logic (correctly filters out-of-stock items and reports them); Playwright e2e for viewing an order's detail/tracking, submitting a return request, and submitting a support ticket end to end.
- [ ] **Documentation:** Document the `ReturnRequest` and `SupportTicket` status lifecycles in `docs/architecture-decisions.md` so the future admin Orders console (STORY-047) and any support console stay in sync with the states this story writes.

## Dependencies
- STORY-001 (Project Foundation Setup)
- STORY-003 (Global Layout & Responsive Framework)
- STORY-033 (Customer Dashboard) — provides the auth-guarded account shell and the "recent orders" summary this story's list expands on
- STORY-028 (Order Management) — owns the `Order`/`OrderItem` data model and status pipeline this story reads from and must not duplicate

## Out of Scope
- Admin-side ticket and return-request moderation UI (Enterprise/Admin Platform epic)
- Live chat and the AI customer support assistant (STORY-063)
- Actual refund/payment reversal processing (owned by STORY-026 Payment Integration / STORY-028 Order Management)

## References
- `docs/blueprint.md` Section 5 (Customer management)
- `docs/blueprint.md` Section 7 (Admin — Orders status pipeline this tracker mirrors)
- `docs/blueprint.md` Section 9 item 6 (Customer Platform)
