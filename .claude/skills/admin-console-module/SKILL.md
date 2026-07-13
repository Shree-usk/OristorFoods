---
name: admin-console-module
description: Build a new admin/back-office console module (e.g. reviews, Q&A, coupons, banners) following Oristor's standard admin patterns — role-based permissions, workflow states, and audit logging. Use whenever adding or extending a section of the admin console.
---

# Admin Console Module

Every admin module in this project follows the same shape. Use this
checklist whenever you build a new one (or extend Reviews, Q&A, Coupons,
Banners, Popups, etc.).

## 1. Permissions first
- Decide which roles can view/edit/delete/approve/export this module
  (Super Admin, Administrator, Marketing Manager, Content Editor, SEO
  Specialist, Viewer, etc.).
- Enforce permission checks in the Service layer, not just hidden UI —
  hiding a button is not access control.

## 2. Workflow state
- Most content modules follow: Draft → (Review) → Approved/Published →
  Archived. Reviews and Q&A follow: Pending → Approved → Published →
  Archived/Deleted.
- Model state as an enum. Every transition should be a discrete action
  (approve, reject, archive) — not a free-text status field.

## 3. List view
- Table with filters (status, date range, search) and bulk actions
  (approve, delete, export) where the source spec calls for them.

## 4. Detail/edit view
- Match the fields specified in `docs/blueprint.md` for that module.
- Any image/file field goes through the Media Library component, not a
  raw uploader.

## 5. Notifications
- If the module involves customer-submitted content (reviews, Q&A),
  trigger a notification on state change (e.g. "your question was
  answered") — check the existing notification service before building
  a new one.

## 6. Audit logging
- Every create/edit/delete/approve/reject action in the admin console
  gets an audit log entry (who, what, when, before/after where relevant).

## 7. Tests
- Unit test permission enforcement and state transitions.
- E2E test the primary workflow (e.g. "admin approves a pending review
  and it appears on the storefront").
