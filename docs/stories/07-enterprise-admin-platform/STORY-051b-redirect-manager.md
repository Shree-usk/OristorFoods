# STORY-051b: Redirect Manager

**Status:** Draft
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** SEO Specialist, Super Administrator

## Context

The second of four sub-stories split out of STORY-051 (SEO Console) —
confirmed with the user 2026-10-02, recorded in `docs/blueprint.md`
Section 9a. Independent of 051a (no shared model) — can be built in any
order relative to it. Covers
`docs/stories/07-enterprise-admin-platform/STORY-051-seo-console.md`'s
redirect-manager AC bullet.

Confirmed before starting 051a: no redirect model, table, or
middleware-level handling exists anywhere in this codebase today
(`next.config.ts` has no `redirects()` block; `src/proxy.ts`'s only
redirects are the admin/account auth guards). This is wholly new
plumbing, not an extension of something existing.

**A note for whoever builds this:** Next.js's `next.config.ts`
`redirects()` array is fixed at build time — it cannot do a per-request
database lookup for admin-managed redirects. Resolution belongs in
`src/proxy.ts` instead, which already runs on every request.
`docs/stories/09-quality-security/STORY-068-seo-validation-qa.md`
explicitly expects redirect rules to "resolve correctly at the
middleware/routing level," confirming this is the intended approach.

## Acceptance Criteria (from the umbrella story)

- [ ] A redirect manager supports creating/editing/deleting 301/302
      redirects, bulk import via CSV, and conflict detection (duplicate
      source paths, redirect chains/loops)

## References

- `docs/stories/07-enterprise-admin-platform/STORY-051-seo-console.md`
  (the umbrella story)
- `docs/blueprint.md` Section 9a (the sub-story split decision)
