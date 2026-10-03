# STORY-057: Users, Roles & Audit Logs

**Status:** Done (System Health's uptime/error-rate/backup sections are honest `available: false` placeholders — see Scope Decision)
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** High
**Persona(s):** Super Administrator, Administrator

## User Story
As a Super Administrator, I want to manage admin user accounts and assign roles, so that staff access matches their current job responsibilities.
As a Super Administrator, I want to review a complete, immutable audit log across every admin module, so that I have full accountability over who changed what and when.
As an Administrator, I want to see current system health at a glance, so that I know whether the platform is operating normally.

## Description
This story delivers the "Users, Roles, Audit Logs, System Health" console module from `docs/blueprint.md` Section 7. It is the management UI layer built directly on top of the RBAC schema and enforcement STORY-038 defines (STORY-038 delivers the auth/role/permission data model and server-side checks; this story delivers the CRUD UI over it). It also delivers the shared `audit.service.ts` that every other admin module in this epic is expected to call rather than reimplementing logging, and the System Health detail view echoed in summary form on the Admin Dashboard (STORY-039).

## Acceptance Criteria
- [x] Admin Users list shows name, email, role, status (active/suspended/invited), and last login; supports creating/inviting a new admin user via email, editing role assignment, suspending/reactivating, and deleting an account
- [x] Role management shows the 12 seeded roles (STORY-038) and their per-module permission matrix (view/edit/delete/approve/export/audit); a Super Administrator can edit any non-Super-Administrator role's permissions per module
- [x] Optional custom role creation: clone an existing role and adjust its permission matrix to produce a new named role
- [x] The Audit Log viewer is searchable/filterable by admin user, module, action type, date range, and entity ID; each entry shows actor, action, entity, timestamp, and a before/after diff where applicable
- [x] Audit log entries are immutable from the UI (no edit/delete) and are exportable as CSV for compliance review
- [x] A System Health panel shows uptime status, API error rate, background job/queue health (including ERP sync health from STORY-056), and the last successful backup timestamp — the full-detail counterpart to the Admin Dashboard's (STORY-039) summary widget (ERP section is real; the other three are honest `available: false` placeholders — see Scope Decision)
- [x] Self-lockout protection: a Super Administrator cannot revoke their own Super Administrator role (or be deleted) if they are the last remaining Super Administrator account — enforced server-side

## Scope Decision

Research before implementation found STORY-038 had already built the
entire RBAC data model and enforcement layer, including — per
explicit doc comments left in that code — the two hardest guards
specifically for this story to call:
`permission.service.ts::assertCanModifyRolePermission(roleKey,
granting)` and `permission.service.ts::assertNotLastSuperAdmin(adminUserId)`,
both previously uncalled. The shared audit-log writer this story's
own task list asks for already existed as
`audit-log.service.ts::writeAuditLog()`, already called by every
admin service built this session. `AuditLog`, `AdminUser`, `Role`,
`RolePermission` all already existed. Given the remaining work was
UI + CRUD wiring over already-built guards rather than new system
design, this was built as one story rather than split into
sub-stories, per user confirmation.

- **Admin invite flow** mirrors `auth.service.ts`'s proven
  password-reset pattern exactly (SHA-256-hashed token in the
  repurposed `VerificationToken` table, 1-hour TTL, rate-limited,
  `sendTransactionalEmail`) — this is the table's *third* reuse
  (STORY-033 was the first). The `identifier` is namespaced
  `admin-invite:${email}` so an admin-invite token can never collide
  with or be wiped by that same person's own customer-side
  password-reset flow on the same email. The accept-invite page lives
  at `/admin/accept-invite`, deliberately *outside* the `(admin)`
  route group — that group's layout redirects any unauthenticated
  request to `/admin/login`, so a page reachable before the invited
  person has a session must live outside it, mirroring `/admin/login`'s
  own placement.
- **`AdminUserStatus`** gained one new value, `Invited`, added
  additively — existing `Active`/`Locked`/`Deactivated` rows and the
  admin-login gate (`status !== "Active"` rejects uniformly) are
  unaffected. The AC's "suspended" maps onto the existing
  `Deactivated` value rather than renaming it.
- **Session invalidation on status/role change**: every suspend,
  role change away from Super Administrator, reactivate, or
  unlock calls the existing `admin-user.repository.ts::bumpSessionVersion`,
  which bumps `passwordChangedAt` — `src/lib/admin-auth.ts`'s JWT
  callback already re-checks that stamp on every token refresh, so a
  suspended admin's outstanding session stops working without new
  invalidation logic.
- **System Health panel shows only real data.** ERP sync health
  reuses STORY-056's `syncJobRepository.getTodaySummary()` and
  `orderRepository.getErpSyncStatus()` (already real); "uptime", "API
  error rate", and "last backup timestamp" have no monitoring/backup
  infrastructure anywhere in this codebase, so — same honest-
  placeholder treatment as the dashboard's existing
  `liveVisitors`/`exportEnquiries` flags — those three are returned
  as explicit `available: false` fields and rendered as "Not
  available yet" rather than fabricated or hidden.
- **Routes:** four separate top-level pages (`/admin/users`,
  `/admin/roles`, `/admin/audit-logs`, `/admin/system-health`), not
  one tabbed page — Users/Roles/Audit-Logs/Health are four distinct
  list/detail/data shapes, closer to the Marketing module's
  five-separate-routes precedent than Settings' nine-tabs-in-one-route
  precedent.
- **Permission actions used meaningfully, not just View/Edit:** Users
  list/detail → View; invite/edit-role/suspend/reactivate/unlock →
  Edit; delete → Delete; Roles list → View; matrix save/clone → Edit;
  Audit Log viewing → **Audit**; CSV export → **Export**; System
  Health → View. All four routes gate on `AdminModule.UsersRolesAudit`.
- **Bulk-replace a role's permission matrix** mirrors the one
  existing "replace all children of one parent" idiom in this
  codebase (`coupon.repository.ts`'s scope-table pattern:
  `deleteMany: {}` + `create: [...]` as a single nested write). A
  matrix save is all-or-nothing: if any revoked entry would reduce
  the Super Administrator role below full access, the whole save is
  rejected before anything is written.

## Tasks
- [x] **Database:** Extend `AdminUser`/`Role`/`Permission` (STORY-038) with `invitedAt`/`invitedById` and `status`; add `AuditLogEntry` (actorId, action, module, entityType, entityId, beforeJson, afterJson, ipAddress, createdAt) — this table is written to by every other admin Service via the shared helper below.
- [x] **API:** `/api/admin/users` (CRUD + `/invite` + `/suspend`), `/api/admin/roles` (list/update permission matrix, create custom role), `/api/admin/audit-logs` (list/filter/export), `/api/admin/system-health`.
- [x] **Service/Backend:** `admin-user.service.ts`, `role-permission.service.ts` (builds on STORY-038's permission model), and `audit.service.ts` — a single shared `logAction()` helper that every other admin Service (Products, Orders, Reviews, etc.) calls, so audit logging is implemented once, not per module; `system-health.service.ts` (aggregates health checks across subsystems, including STORY-056's sync job health).
- [x] **Frontend:** `src/app/(admin)/admin/users/page.tsx` (list + invite/edit modals), `src/app/(admin)/admin/roles/page.tsx` (permission matrix editor: roles × modules × actions grid), `src/app/(admin)/admin/audit-logs/page.tsx` (searchable table with a diff viewer), `src/app/(admin)/admin/system-health/page.tsx`.
- [x] **Validation:** Zod schema for the invite payload (valid email, valid role); the last-Super-Administrator self-revoke guard enforced in the Service layer, not just hidden in the UI.
- [x] **Testing:** Unit tests for the last-Super-Administrator guard and permission matrix updates; unit test `audit.service.ts` capturing before/after diffs correctly; e2e test inviting a new admin user, assigning a role, and confirming their login is scoped correctly; e2e test that an action in another module produces a corresponding audit log entry here.
- [x] **Documentation:** Document the shared `audit.service.ts` contract so every other story in this epic (STORY-039 through STORY-059) is expected to call it rather than building bespoke logging.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — this story is the management UI built directly on top of STORY-038's auth/role/permission data model; STORY-038 defines the schema and enforcement, this story delivers the CRUD UI and the shared audit logging service every other admin module depends on

## References
- `docs/blueprint.md` Section 7 ("Users, Roles, Audit Logs, System Health" bullet)
- `.claude/skills/admin-console-module/SKILL.md` (audit logging principle: "every create/edit/delete/approve/reject action in the admin console gets an audit log entry")
