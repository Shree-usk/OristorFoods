# STORY-036: Order History & Support

**Status:** Done — see the STORY-036 entry in `docs/architecture-decisions.md`.
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
- [x] Order list is paginated, filterable by status and date range, sorted most-recent-first. *The status list uses the real `OrderStatus` enum (`PendingConfirmation/Confirmed/Processing/Dispatched/Delivered/Cancelled/Returned`), not this AC's stale wording — see `docs/architecture-decisions.md`.*
- [x] Each order card shows order number, order date, item thumbnails, order total, a status badge, and "View Details" / "Reorder" actions
- [x] Order detail page shows line items (product, quantity, unit price, image), the shipping address used, a payment summary, and a status timeline that mirrors STORY-028's pipeline stages *(reuses STORY-028's own `OrderStatusTimeline` unmodified)*
- [x] Order detail page shows carrier/tracking number and a tracking link once the order is dispatched, and offers an invoice/packing-slip PDF download
- [x] "Reorder" adds all still-in-stock items from the past order to the cart in one action; any out-of-stock items are flagged and skipped with an explanatory message rather than blocking the whole reorder
- [x] A return request can be initiated from a delivered order's detail page (reason, affected items, quantities); the request is stored as `Requested`, ready for the admin Orders console (STORY-047) to process. *Admin-side approval/processing is explicitly out of scope here per this story's own "Out of Scope" section.*
- [x] Support page presents a contact form with a subject category (incl. "Order Issue"), message body, and an optional order reference — arriving pre-filled with the order number when launched from an order's "Contact Support" link
- [x] Submitting the support form creates a ticket the customer can subsequently see in a ticket history list on the same page, with status (Open/In Progress/Resolved/Closed)
- [x] All order and ticket data is fetched through services (`customer-order-history.service.ts` wrapping STORY-028's `order.service.ts`, this story's own `support-ticket.service.ts`); no direct Prisma access from account pages or route handlers
- [x] Zero-orders state shows a "Browse Products" CTA instead of an empty table
- [x] Order list/detail is responsive, reusing the account shell's existing responsive Card layout

## Tasks
- [x] **Database:** `ReturnRequest` (`orderId`, `items` JSON snapshot, `reason`, `status` enum `Requested/Approved/Rejected/Completed`, timestamps) and `SupportTicket` (`userId`, `orderId?`, `category`, `subject`, `message`, `status` enum `Open/InProgress/Resolved/Closed`, timestamps). **No `TicketMessage` model** — confirmed with the user: no AC requires a reply thread, and admin-side moderation (the only thing that would reply) is out of scope. Also added `carrier`/`trackingNumber`/`trackingUrl` to `Order` (nothing wrote these before this story). See `docs/architecture-decisions.md`.
- [x] **API:** Extended `GET /api/orders` in place with optional `status`/`dateFrom`/`dateTo` filters (nothing else consumed its previous shape). New: `POST /api/orders/[orderNumber]/reorder`, `POST /api/orders/[orderNumber]/return-request`, `GET /api/orders/[orderNumber]/invoice` (PDF), `GET/POST /api/account/support/tickets`. Dropped the task list's separate `GET /api/account/orders*` routes and `GET /api/account/support/tickets/[id]` (no ticket-detail view — the history list shows everything the AC needs). Route param is `[orderNumber]`, not `[id]` — matches the codebase-wide convention STORY-028 already established.
- [x] **Service:** `customer-order-history.service.ts` (wraps `order.service.ts`/`order.repository.ts`, ownership-checked on every call via the existing `getOrderForConfirmation`); `support-ticket.service.ts`; `invoice-pdf.service.ts` — no existing invoice generation to reuse (confirmed by grep), built fresh on `recipe-pdf.service.tsx`'s `@react-pdf/renderer` pattern.
- [x] **Frontend:** `src/app/(storefront)/account/(dashboard)/orders/page.tsx`, `orders/[orderNumber]/page.tsx`, `support/page.tsx`; `OrderListItem`, `OrderFilterBar`, `ReorderButton`, `ReturnRequestDialog`, `SupportTicketForm`, `TicketHistoryList` under `src/components/storefront/account/`. Reused STORY-028's `OrderStatusTimeline` rather than rebuilding it. Fixed `account-nav.tsx`/`quick-links-card.tsx`'s dangling `/support` link to `/account/support`.
- [x] **Validation:** `src/validation/return-request.schema.ts`, `support-ticket.schema.ts` — flat, matching the rest of `src/validation/` (no `account/` subfolder exists anywhere).
- [x] **Testing:** `customer-order-history-service.test.ts` (pure reorder-filtering logic: in-stock, deleted-product, unpublished, zero-stock, partial-cap; plus status-filtered listing). `support-ticket-service.test.ts` (creation with/without an order reference, cross-customer ownership rejection, pagination). `tests/e2e/order-history-support.spec.ts` (empty states, order detail/tracking, reorder, return-request submission, support-ticket submission with and without pre-fill).
- [x] **Documentation:** `docs/architecture-decisions.md` documents every deviation above plus the `ReturnRequest`/`SupportTicket` status lifecycles for STORY-047's future admin console.

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
