# STORY-038: Admin Auth & RBAC

**Status:** Draft
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
- [ ] Admin login lives at a dedicated route (e.g. `/admin/login`) using a separate NextAuth configuration/session cookie from the storefront customer auth flow — an admin session cannot be used to access customer account pages and vice versa
- [ ] All 12 roles from blueprint Section 7 are seeded in the database: Super Administrator, Administrator, Marketing Manager, Sales Manager, Finance Manager, Production Manager, Warehouse Manager, Customer Support, Export Manager, Content Editor, SEO Specialist, Viewer
- [ ] A permission matrix models every admin module (Products, Media Library, Homepage Builder, Recipes, Blog, Reviews, Q&A, Orders, Customers, Rewards & Referrals, Marketing, SEO, Navigation, CMS Workflow, System Settings, Delivery Zones, ERP Integration, Users/Roles/Audit, Export Portal, CRM/Analytics) crossed with actions (view, edit, delete, approve, export, audit) — each role has an independently configurable true/false per module × action cell
- [ ] The Super Administrator role's permission matrix cannot be reduced below full access, and the system prevents deleting or de-elevating the last remaining Super Administrator account (lockout protection)
- [ ] Failed login attempts are rate-limited/locked out after a defined threshold; Super Administrator and Administrator roles support optional TOTP-based two-factor authentication
- [ ] The resolved session includes the user's role and its computed permission set; every protected route and API handler checks permissions server-side (in the Service layer) — hiding a UI button is never treated as access control
- [ ] An authenticated admin without permission for a given module/action receives a 403 response (API) or an access-denied page (UI), and the attempt is written to the audit log
- [ ] An email-based invite flow exists for provisioning a new admin user with an assigned role, and a password-reset flow exists for existing admin users
- [ ] Every route under the `(admin)` route group requires a valid authenticated admin session before rendering; unauthenticated requests redirect to `/admin/login` with a return-to path
- [ ] Permission assignments are stored in the database (not hardcoded), so changing what a role can do takes effect immediately without a redeploy

## Tasks
- [ ] **Database:** Define `AdminUser` (or an `isAdmin`/`role` extension of the base `User` model — decide and document which), `Role`, `Permission` (module + action enum), `RolePermission` join table, and `AdminInvite` (email, token, roleId, expiresAt). Seed the 12 roles and a sensible default permission matrix (Super Administrator = full access to everything; Viewer = view-only everywhere; other roles scoped to their functional area, e.g. Marketing Manager gets edit on Marketing/Homepage Builder/SEO, view elsewhere).
- [ ] **API:** `/api/admin/auth/[...nextauth]` (dedicated admin NextAuth handler/provider), `/api/admin/auth/invite`, `/api/admin/auth/accept-invite`, `/api/admin/auth/reset-password`, `/api/admin/auth/2fa/setup` and `/verify`.
- [ ] **Service/Backend:** `admin-auth.service.ts` (login, invite, password reset, 2FA), `permission.service.ts` exposing a `hasPermission(session, module, action)` helper and a `requirePermission()` guard usable in every other admin Service/route handler; middleware enforcing session presence on all `(admin)` routes.
- [ ] **Frontend:** `/admin/login` page (with 2FA challenge step where enabled), `src/app/(admin)/layout.tsx` enforcing session + role resolution before rendering children, an `AccessDenied` component, permission-aware UI helpers (`<RequirePermission module="products" action="edit">`) used across the epic's other modules.
- [ ] **Validation:** Zod schemas for login credentials, invite payload, password reset payload, and TOTP verification code format.
- [ ] **Testing:** Unit tests for permission-matrix resolution (role → module → action → boolean) including the Super Administrator floor and last-Super-Administrator lockout guard; e2e tests for login/logout, invite → accept → first login, unauthorized access redirect/403, and 2FA challenge flow.
- [ ] **Documentation:** Document the full permission matrix (module × action × default-per-role) and the admin session/cookie separation decision in `docs/architecture-decisions.md`.

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
