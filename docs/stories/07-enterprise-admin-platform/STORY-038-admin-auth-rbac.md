# STORY-038: Admin Auth & RBAC

**Status:** Core landed — separate admin auth, the 12-role seed, the full permission matrix + server-side enforcement, audit logging, and route guarding are done (see the STORY-038 entry in `docs/architecture-decisions.md`). Self-service email invite, admin password reset, and TOTP 2FA are explicitly deferred to follow-up work — confirmed with the user before starting; the initial Super Administrator is created by `prisma/seed-admin.ts` instead. Not marked Done until that follow-up work lands.
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** High
**Persona(s):** Super Administrator, Administrator, Marketing Manager, Sales Manager, Finance Manager, Production Manager, Warehouse Manager, Customer Support, Export Manager, Content Editor, SEO Specialist, Viewer

## User Story
As a Super Administrator, I want a secure admin login that is entirely separate from storefront customer authentication, so that back-office access cannot be reached through the customer login surface.
As a Super Administrator, I want the platform to enforce 12 distinct staff roles with granular per-module permissions (view/edit/delete/approve/export/audit), so that each staff member can only see and do what their job requires.
As any admin role, I want my access to be denied clearly and safely when I lack permission for an action, so that mistakes and privilege escalation are prevented by the system, not by convention.

## Description
This story is the security foundation for the entire Enterprise/Admin Platform epic. It delivers a dedicated admin authentication flow (separate route, separate session from the storefront's customer auth), the 12 roles defined in `docs/blueprint.md` Section 7 (Super Administrator, Administrator, Marketing Manager, Sales Manager, Finance Manager, Production Manager, Warehouse Manager, Customer Support, Export Manager, Content Editor, SEO Specialist, Viewer), and a granular per-module permission model (view/edit/delete/approve/export/audit). Every other story in this epic (STORY-039 through STORY-059) is gated on this story: no admin route, API, or Service-layer action may execute without a resolved role and a server-side permission check.

## Acceptance Criteria
- [x] Admin login lives at a dedicated route (`/admin/login`) using a separate NextAuth configuration/session cookie from the storefront customer auth flow — an admin session cannot be used to access customer account pages and vice versa
- [x] All 12 roles from blueprint Section 7 are seeded in the database: Super Administrator, Administrator, Marketing Manager, Sales Manager, Finance Manager, Production Manager, Warehouse Manager, Customer Support, Export Manager, Content Editor, SEO Specialist, Viewer
- [x] A permission matrix models every admin module (Products, Media Library, Homepage Builder, Recipes, Blog, Reviews, Q&A, Orders, Customers, Rewards & Referrals, Marketing, SEO, Navigation, CMS Workflow, System Settings, Delivery Zones, ERP Integration, Users/Roles/Audit, Export Portal, CRM/Analytics) crossed with actions (view, edit, delete, approve, export, audit) — each role has an independently configurable per module × action cell. *Sparse/existence-based rather than a dense true/false cell for all ~1,440 combinations — see `docs/architecture-decisions.md`.*
- [x] The Super Administrator role's permission matrix cannot be reduced below full access, and the system prevents deleting or de-elevating the last remaining Super Administrator account (lockout protection). *Both guards built and unit-tested; no caller yet since STORY-057's role-editing UI doesn't exist yet — see architecture-decisions.md.*
- [x] Failed login attempts are rate-limited/locked out after a defined threshold (5 attempts / 15 minutes, DB-persisted). *TOTP 2FA deferred — see the Status note above.*
- [x] The resolved session includes the user's role (fetched server-side, never cached in the JWT) and its computed permission set is checked fresh from the DB on every call; every protected route and API handler checks permissions server-side (in the Service layer) — hiding a UI button is never treated as access control
- [x] An authenticated admin without permission for a given module/action receives a 403 response (API, via `PermissionDeniedError`) or an access-denied page (UI, `AccessDenied`/`RequirePermission`), and the attempt is written to the audit log
- [ ] Deferred: an email-based invite flow for provisioning a new admin user, and a password-reset flow for existing admin users. Neither blocks any later admin story. See `docs/architecture-decisions.md`.
- [x] Every route under the `(admin)` route group requires a valid authenticated admin session before rendering; unauthenticated requests redirect to `/admin/login` with a return-to path
- [x] Permission assignments are stored in the database (not hardcoded), so changing what a role can do takes effect immediately without a redeploy

## Tasks
- [x] **Database:** `AdminUser` (a fully separate model from `User` — the schema's own pre-existing header comment already said as much), `Role` (with a stable `key` separate from its editable `name`), `AdminModule`/`AdminAction` enums, `RolePermission` (sparse join table), `AuditLog`. `AdminInvite` deferred alongside the invite flow it exists for.
- [x] **API:** `/api/admin/auth/[...nextauth]` (dedicated admin NextAuth handler). `/api/admin/auth/invite`, `/accept-invite`, `/reset-password`, `/2fa/setup`, `/2fa/verify` deferred. New: `GET /api/admin/ping` (proves the session-gating chain for API routes).
- [x] **Service/Backend:** `admin-auth.service.ts` (login only this pass — invite/reset/2FA deferred), `permission.service.ts` exposing `hasPermission`/`requirePermission` (always a fresh DB read, never JWT-cached) plus the Super-Administrator-floor and last-Super-Administrator guards, `audit-log.service.ts`; `src/proxy.ts` gained a second guard block for `/admin/*` (Next.js 16 permits only one project-wide proxy file).
- [x] **Frontend:** `/admin/login` (no 2FA challenge step — deferred), `src/app/(admin)/layout.tsx` enforcing session + role resolution, `AccessDenied`, `<RequirePermission module action>` for future modules to use, a minimal `/admin` landing page (the full dashboard is STORY-039's scope).
- [x] **Validation:** `admin-auth.schema.ts` (login credentials only this pass).
- [x] **Testing:** `permission-service.test.ts` (matrix resolution, Super Administrator floor, last-Super-Administrator guard) and `admin-auth-service.test.ts` (login success/failure/lockout/no-enumeration/force-logout) unit tests; `admin-auth.spec.ts` e2e (login, logout, lockout, unauthenticated redirect, admin↔customer session separation). Invite/2FA e2e flows deferred alongside those features.
- [x] **Documentation:** Full permission matrix, admin session/cookie/secret separation, and every deviation documented in `docs/architecture-decisions.md`.

## Dependencies
- STORY-001 (Project Foundation Setup) — Next.js/Prisma/NextAuth base and the `(admin)` route group must exist
- STORY-002 (Design System & Theming) — login and admin shell UI use shared design tokens/Shadcn components
- STORY-003 (Global Layout & Responsive Framework) — admin login/shell renders within the shared layout framework

## Out of Scope
- The user-management/role-editing UI itself (list admins, edit their role, view audit logs) — that UI is delivered in STORY-057, which builds on the schema and enforcement this story defines
- SSO / enterprise identity provider (SAML/OIDC) integration — future enhancement, not required for launch
- Customer-facing (storefront) authentication — covered elsewhere and explicitly kept separate from this story's admin auth

## References
- `docs/blueprint.md` Section 7 ("Access: secure web-based portal, role-based permissions...")
- `docs/blueprint.md` Section 8 (enterprise security standards)
- `.claude/skills/admin-console-module/SKILL.md` (permissions-first principle, audit logging)
