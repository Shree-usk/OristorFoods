# STORY-066: Performance Optimization

**Status:** Draft
**Epic:** 09 — Quality & Security
**Priority:** High
**Persona(s):** Platform Stakeholder, Engineering Team, End User (Home Cook, Busy Professional, Sri Lankan Expat, Gourmet Food Enthusiast, Distributor, Executive — all benefit from a fast platform)

## User Story
As a platform stakeholder, I want the platform to hit Lighthouse >95 and API responses under 300ms across every major page and endpoint, so that ODEP delivers the "excellent Core Web Vitals, enterprise-grade UX" the 12-month success metrics require.
As the engineering team, I want a documented caching strategy, bundle size budget, and load-testing baseline, so that performance doesn't regress silently as features (Epics 01–08) accumulate.
As a Busy Professional (end user), I want pages to load fast and feel instant on mobile, so that I can browse products and check out without friction during a short window of free time.

## Description
This story delivers the performance half of Build Order item 9, "Quality & Security" (`docs/blueprint.md` Section 9), targeting the Section 6 technical success targets: **Lighthouse score >95**, **API response <300ms**, and **99.9% availability**. It is a platform-wide optimization pass across every route built in Epics 01–08 — homepage, product/recipe listings and detail pages, checkout, customer dashboard, and the admin console — plus the infrastructure decisions (caching, image/font strategy, bundle budgets) that keep performance sustainable as the codebase grows. It runs continuously via Section 8's mandatory PR performance gate and again as a dedicated hardening pass before Epic 10 Production Launch.

## Acceptance Criteria
- [ ] Lighthouse score exceeds **95** (Performance category) on: Homepage, Product Listing, Product Detail, Recipe Centre, Recipe Detail, Checkout, and Customer Dashboard — measured on both mobile and desktop presets, per `docs/blueprint.md` Section 6
- [ ] Core Web Vitals meet "Good" thresholds on the same page set: **LCP < 2.5s**, **INP < 200ms**, **CLS < 0.1**, measured via field data (Real User Monitoring) or lab data (Lighthouse/PageSpeed Insights) where field data is unavailable pre-launch
- [ ] The 95th-percentile API response time for all `GET` Route Handlers under typical load is **under 300ms**, measured via load-testing tooling against a staging environment matching production configuration
- [ ] All product/recipe/blog imagery is served via `next/image` with responsive `sizes`, modern formats (WebP/AVIF), and correctly configured priority/lazy-loading — zero unoptimized `<img>` tags remain in customer-facing routes
- [ ] All web fonts (Cormorant Garamond, Inter) are loaded via `next/font` with `font-display: swap` (or equivalent) and self-hosted/subset to avoid render-blocking external font requests, per Section 2's typography spec
- [ ] A documented caching strategy is implemented and verified: static/ISR caching for content pages (product, recipe, blog) with defined revalidation windows, HTTP cache headers on cacheable API responses, and a documented plan for Redis-backed caching once that infrastructure lands (Section 3 marks Redis "planned/future")
- [ ] A JavaScript bundle size budget is defined and enforced in CI (e.g. via `next build` output analysis or a bundle-analyzer check) — initial route JS for the homepage and product detail page stays under an agreed budget (e.g. ≤ 200KB gzipped first-load JS), with the build failing if the budget is exceeded without an explicit override
- [ ] Server Components are used by default per Section 3's architecture principle ("Server Components by default, Client Components only where interactivity is required") — an audit confirms no unnecessary `"use client"` directives on primarily-static content across Epics 01–08 routes
- [ ] Database query performance is verified: N+1 query patterns are eliminated on high-traffic list/detail endpoints (product listing, recipe listing, order history), confirmed via Prisma query logging/EXPLAIN ANALYZE on the top 10 most-called queries
- [ ] Load testing confirms the platform sustains a defined concurrent-user target (e.g. simulating expected launch-day traffic) while maintaining the <300ms API response target and without error-rate degradation, supporting the Section 6 **99.9% availability** target
- [ ] A performance regression budget is wired into the CI pipeline (Lighthouse CI or equivalent) so that any PR dropping a tracked page's Lighthouse score below 95 fails the build, operationalizing Section 8's mandatory "performance" PR gate
- [ ] Third-party scripts (analytics, chat/support widgets, AI assistant embeds from Epic 08) are audited for render-blocking impact and loaded via `next/script` with appropriate `strategy` (`lazyOnload`/`worker`) where possible

## Tasks

- [ ] **Service/Backend:**
  - [ ] Profile and optimize the top 10 highest-traffic API routes/service methods (product listing, recipe listing, cart, checkout, search) using Prisma query logging and `EXPLAIN ANALYZE`; add/adjust database indexes where scans are unindexed
  - [ ] Implement response caching (HTTP `Cache-Control`/`stale-while-revalidate` or ISR `revalidate`) on read-heavy, low-volatility endpoints (product catalogue, recipe listing, blog)
  - [ ] Document and, where feasible, implement an interim caching layer (in-memory or edge cache) ahead of the planned Redis rollout, with a clear migration note in `docs/architecture-decisions.md`

- [ ] **Frontend:**
  - [ ] Audit all customer-facing image usage and migrate any remaining raw `<img>` tags to `next/image` with correct `sizes`/`priority`
  - [ ] Configure `next/font` for Cormorant Garamond and Inter with subsetting and `display: swap`
  - [ ] Audit `"use client"` boundaries across Epics 01–08 components; convert unnecessary client components to Server Components, pushing interactivity to leaf components only
  - [ ] Configure code-splitting/dynamic `import()` for below-the-fold or rarely-used heavy components (e.g. product image zoom, video players, admin rich-text editor)
  - [ ] Audit and defer/optimize third-party scripts using `next/script` strategies

- [ ] **Validation:**
  - [ ] Define and document the bundle size budget (per key route) and wire a bundle-analyzer check into the build
  - [ ] Define the concurrent-user load-testing target and acceptance thresholds with the platform stakeholder before running load tests

- [ ] **Testing:**
  - [ ] Set up Lighthouse CI (or equivalent) against the defined page set, run on every PR, failing below score 95
  - [ ] Run load testing (e.g. k6, Artillery, or similar) against a staging environment simulating the agreed concurrent-user target; capture 95th-percentile API latency and error rate
  - [ ] Capture Core Web Vitals via lab tooling (PageSpeed Insights/Lighthouse) for all key pages and record baseline results
  - [ ] Add a CI job that fails the build if the JS bundle budget is exceeded

- [ ] **Documentation:**
  - [ ] Publish a Performance Optimization Report documenting before/after Lighthouse scores, Core Web Vitals, API latency percentiles, and load-test results for the defined page/endpoint set
  - [ ] Document the caching strategy (what's cached, revalidation windows, planned Redis migration) in `docs/architecture-decisions.md`
  - [ ] Document the bundle size budget and how to run the analyzer locally

## Dependencies
- All prior epics (01-08) — this epic validates and hardens what has been built, it runs continuously alongside feature work per blueprint Section 8's mandatory PR validation gates, and again as a dedicated pass before Epic 10 Production Launch

## Out of Scope
- Standing up production Redis/BullMQ infrastructure (Section 3 marks these "planned/future"); this story documents the interim strategy and migration path only
- CDN/edge network provisioning and domain-level infrastructure decisions (belongs to Epic 10 — Production Launch)
- AI model inference latency tuning for Epic 08 features beyond ensuring their client-side loading doesn't block page render

## References
- `docs/blueprint.md` Section 6 (Non-Functional Principles — Performance; Lighthouse >95, API <300ms, 99.9% availability targets)
- `docs/blueprint.md` Section 8 (Development Governance — mandatory PR performance gate)
- `docs/blueprint.md` Section 9 item 9 (Quality & Security)
- `docs/blueprint.md` Section 3 (Technology Stack — Server Components default, Redis/BullMQ planned/future)
