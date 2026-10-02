# STORY-051b: Redirect Manager

**Status:** Done (core scope) — see `docs/architecture-decisions.md`
2026-10-02 entry for deviations (the chain-ban-prevents-loops proof
that avoids graph traversal; a 10s cache TTL, not 30s, after an e2e
test caught that eager cache invalidation can't cross the proxy/
route-handler module-bundle boundary; hand-rolled CSV parsing instead
of a new dependency; `statusCode` as a plain `Int`).

**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** SEO Specialist, Super Administrator

## Context

The second of four sub-stories split out of STORY-051 (SEO Console) —
confirmed with the user 2026-10-02, recorded in `docs/blueprint.md`
Section 9a. Independent of 051a (no shared model). Covers
`docs/stories/07-enterprise-admin-platform/STORY-051-seo-console.md`'s
redirect-manager AC bullet.

Confirmed before starting: no redirect model, table, or
middleware-level handling existed anywhere in this codebase (no
`next.config.ts` `redirects()` block; `src/proxy.ts`'s only redirects
were the admin/account auth guards) — wholly new plumbing. Resolution
lives in `src/proxy.ts` rather than `next.config.ts`'s `redirects()`
(fixed at build time, can't do a per-request DB lookup) —
`docs/stories/09-quality-security/STORY-068-seo-validation-qa.md`
explicitly expects this.

## Acceptance Criteria

- [x] A redirect manager supports creating/editing/deleting 301/302
      redirects
- [x] Bulk import via CSV, with per-row success/failure reporting
- [x] Conflict detection: duplicate source paths (a DB `@unique`
      constraint), and redirect chains/loops (a single flat rule that
      transitively prevents both — see the architecture-decisions.md
      entry for the proof)

## Tasks

- [x] **Database:** `Redirect` (`sourcePath` unique, `destinationPath`,
      `statusCode`, `active`, `createdById`).
- [x] **API:** `/api/admin/seo/redirects` (list/create), `/[id]`
      (detail/update/delete), `/bulk-import` (CSV text in, per-row
      result summary out).
- [x] **Service/Backend:** `redirect.service.ts` (admin CRUD, the pure
      `detectRedirectConflict` rule, `bulkImportRedirects`);
      `src/lib/csv.ts` (hand-rolled parser); `src/lib/redirect-cache.ts`
      (the TTL + in-flight-dedup cache `src/proxy.ts` reads).
- [x] **Frontend:** `src/app/(admin)/admin/seo/redirects/` (list + new
      + edit), a CSV upload control on the list view, result summary
      rendering.
- [x] **Validation:** `redirect.schema.ts` — paths must start with
      `/`, `statusCode` constrained to `301 | 302`.
- [x] **Testing:** `tests/unit/redirect-service.test.ts` (9 tests —
      CRUD + audit logging, permission gating, the real DB duplicate
      error, every `detectRedirectConflict` case, a full CSV bulk-
      import scenario); `tests/unit/csv.test.ts` (6 tests);
      `tests/unit/redirect-cache.test.ts` (2 tests — single fetch
      serving multiple reads, concurrent-miss de-duplication);
      `tests/e2e/admin-redirects.spec.ts` (permission-denied create,
      real console creation, a real separate storefront visitor
      actually redirected once the cache TTL elapses).
- [x] **Documentation:** `docs/architecture-decisions.md` 2026-10-02
      entry documents the conflict-detection proof, the module-bundle-
      isolation discovery and the resulting TTL adjustment, the CSV
      scope cut, and the `statusCode` type choice.

## Dependencies

- STORY-038 (Admin Auth & RBAC) — gates this module's actions (`SEO`
  module, already existed, confirmed before 051a)
- STORY-068 (SEO Validation QA) — downstream consumer; confirms
  redirect rules must resolve at the middleware/routing level, which
  this story delivers

## Out of scope (left for future work)

- Full RFC4180 CSV quoting support — URL paths don't contain commas in
  practice; a deliberate, documented scope cut
- Cross-instance cache invalidation for a multi-instance deployment —
  the TTL is the correctness bound everywhere; this repo has no
  multi-instance deployment yet (hosting is still unconfirmed per
  blueprint.md Section 10)

## References

- `docs/stories/07-enterprise-admin-platform/STORY-051-seo-console.md`
  (the umbrella story)
- `docs/stories/09-quality-security/STORY-068-seo-validation-qa.md`
- `docs/blueprint.md` Section 9a (the sub-story split decision)
