# STORY-057: Users, Roles & Audit Logs

**Status:** Draft
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
- [ ] Admin Users list shows name, email, role, status (active/suspended/invited), and last login; supports creating/inviting a new admin user via email, editing role assignment, suspending/reactivating, and deleting an account
- [ ] Role management shows the 12 seeded roles (STORY-038) and their per-module permission matrix (view/edit/delete/approve/export/audit); a Super Administrator can edit any non-Super-Administrator role's permissions per module
- [ ] Optional custom role creation: clone an existing role and adjust its permission matrix to produce a new named role
- [ ] The Audit Log viewer is searchable/filterable by admin user, module, action type, date range, and entity ID; each entry shows actor, action, entity, timestamp, and a before/after diff where applicable
- [ ] Audit log entries are immutable from the UI (no edit/delete) and are exportable as CSV for compliance review
- [ ] A System Health panel shows uptime status, API error rate, background job/queue health (including ERP sync health from STORY-056), and the last successful backup timestamp — the full-detail counterpart to the Admin Dashboard's (STORY-039) summary widget
- [ ] Self-lockout protection: a Super Administrator cannot revoke their own Super Administrator role (or be deleted) if they are the last remaining Super Administrator account — enforced server-side

## Tasks
- [ ] **Database:** Extend `AdminUser`/`Role`/`Permission` (STORY-038) with `invitedAt`/`invitedById` and `status`; add `AuditLogEntry` (actorId, action, module, entityType, entityId, beforeJson, afterJson, ipAddress, createdAt) — this table is written to by every other admin Service via the shared helper below.
- [ ] **API:** `/api/admin/users` (CRUD + `/invite` + `/suspend`), `/api/admin/roles` (list/update permission matrix, create custom role), `/api/admin/audit-logs` (list/filter/export), `/api/admin/system-health`.
- [ ] **Service/Backend:** `admin-user.service.ts`, `role-permission.service.ts` (builds on STORY-038's permission model), and `audit.service.ts` — a single shared `logAction()` helper that every other admin Service (Products, Orders, Reviews, etc.) calls, so audit logging is implemented once, not per module; `system-health.service.ts` (aggregates health checks across subsystems, including STORY-056's sync job health).
- [ ] **Frontend:** `src/app/(admin)/users/page.tsx` (list + invite/edit modals), `src/app/(admin)/roles/page.tsx` (permission matrix editor: roles × modules × actions grid), `src/app/(admin)/audit-logs/page.tsx` (searchable table with a diff viewer), `src/app/(admin)/system-health/page.tsx`.
- [ ] **Validation:** Zod schema for the invite payload (valid email, valid role); the last-Super-Administrator self-revoke guard enforced in the Service layer, not just hidden in the UI.
- [ ] **Testing:** Unit tests for the last-Super-Administrator guard and permission matrix updates; unit test `audit.service.ts` capturing before/after diffs correctly; e2e test inviting a new admin user, assigning a role, and confirming their login is scoped correctly; e2e test that an action in another module (e.g. approving a review in STORY-045) produces a corresponding audit log entry here.
- [ ] **Documentation:** Document the shared `audit.service.ts` contract so every other story in this epic (STORY-039 through STORY-059) is expected to call it rather than building bespoke logging.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — this story is the management UI built directly on top of STORY-038's auth/role/permission data model; STORY-038 defines the schema and enforcement, this story delivers the CRUD UI and the shared audit logging service every other admin module depends on

## References
- `docs/blueprint.md` Section 7 ("Users, Roles, Audit Logs, System Health" bullet)
- `.claude/skills/admin-console-module/SKILL.md` (audit logging principle: "every create/edit/delete/approve/reject action in the admin console gets an audit log entry")
