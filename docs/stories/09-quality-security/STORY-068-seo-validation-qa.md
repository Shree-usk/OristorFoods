# STORY-068: SEO Validation & Final QA

**Status:** Draft
**Epic:** 09 — Quality & Security
**Priority:** High
**Persona(s):** Platform Stakeholder, Engineering Team, SEO Specialist (admin), Compliance/Security Officer

## User Story
As a platform stakeholder, I want structured data, meta tags, sitemaps, and Core Web Vitals validated site-wide before launch, so that ODEP is fully discoverable by search engines from day one and can compete with premium international food brands on organic reach.
As an SEO Specialist, I want every page type (product, recipe, blog, category, Food Academy) to carry correct, validated schema markup and meta fields, so that rich results and accurate previews render in search and social shares.
As the engineering team, I want a full cross-browser/cross-device regression pass across every epic's functionality, so that we catch integration bugs between features before they reach production.

## Description
This story delivers the SEO validation and final QA half of Build Order item 9, "Quality & Security" (`docs/blueprint.md` Section 9), and is the last dedicated quality gate before Epic 10 Production Launch. It validates the SEO fields and schema markup that Epic 07's SEO Console (Section 7) and per-product/recipe SEO fields (Section 5) are designed to populate, confirms the technical SEO plumbing (sitemap, robots.txt, canonical URLs, structured data) works correctly across the whole site, and runs a full regression pass across every customer-facing and admin flow built in Epics 01–08 to confirm the platform behaves consistently across browsers and devices. It complements STORY-066 (Performance) by re-validating Core Web Vitals specifically as an SEO ranking factor, and complements STORY-065/STORY-067 by serving as the final combined QA sign-off gate.

## Acceptance Criteria
- [ ] Every page type (Homepage, Product Detail, Product Listing/Category, Recipe Detail, Recipe Listing, Blog Post, Food Academy, About, Export, Static/Legal pages) renders valid, error-free **JSON-LD structured data** appropriate to its type (`Product`, `Recipe`, `BreadcrumbList`, `Organization`, `Article`/`BlogPosting`, `FAQPage` where applicable) — validated with zero errors via Google's Rich Results Test / Schema.org validator
- [ ] Every indexable page has a unique, populated `<title>` (50–60 chars target) and meta description (150–160 chars target) sourced from the per-page SEO fields defined in Section 5/7 — an automated crawl confirms zero duplicate titles/descriptions and zero missing titles/descriptions across all indexable routes
- [ ] Open Graph and Twitter Card meta tags (`og:title`, `og:description`, `og:image`, `og:type`, `twitter:card`) are present and correctly populated on every shareable page (product, recipe, blog, homepage), verified via a social share preview debugger
- [ ] Every page declares a correct `<link rel="canonical">` pointing to its preferred URL, with no conflicting/self-referencing errors on paginated or filtered listing pages
- [ ] `sitemap.xml` is dynamically generated, includes all published products, recipes, blog posts, and static pages, excludes draft/archived/noindex content, and is submitted/validated in Google Search Console (or validated against the sitemap protocol if Search Console access isn't yet provisioned)
- [ ] `robots.txt` correctly allows crawling of public storefront routes and disallows the admin console (`/admin` or the `(admin)` route group's resolved paths), cart, checkout, and account routes, and references the sitemap location
- [ ] All product/recipe/category images used in SEO-relevant contexts (Open Graph images, structured data `image` fields) meet the platform's minimum dimension/format requirements for rich result eligibility
- [ ] Core Web Vitals (LCP, INP, CLS) meet "Good" thresholds on the same key page set validated in STORY-066, re-confirmed here specifically as a ranking-factor gate using Google PageSpeed Insights / Search Console Core Web Vitals report
- [ ] URL structure is clean, human-readable, and consistent (kebab-case slugs, no trailing query-param pollution on canonical listing URLs) across products, recipes, categories, and blog
- [ ] A 404 page and a redirect strategy (301s for the SEO Console's "redirects" feature per Section 7) are verified functional, with zero broken internal links found in a full-site crawl
- [ ] Full regression test pass is completed across the critical path of every epic: homepage → navigation (02), product browse/search/detail/wishlist/compare/reviews (03), recipe browse/detail/bookmarks (04), cart/checkout/payment/orders/rewards/referrals (05), customer dashboard/profile/order history (06), admin CRUD across all console modules (07), AI search/recommendations/assistant (08) — each flow completes end-to-end with zero blocking (P0/P1) defects
- [ ] Cross-browser QA passes on the latest two versions of Chrome, Firefox, Safari, and Edge with zero functional or visual-breaking defects on the critical customer journey
- [ ] Cross-device QA passes on representative mobile (iOS Safari, Android Chrome), tablet, and desktop viewports with zero functional or visual-breaking defects
- [ ] A final combined sign-off checklist (referencing STORY-065 security, STORY-066 performance, STORY-067 accessibility, and this story's SEO/QA results) is produced and approved before the platform is handed to Epic 10 for production launch

## Tasks

- [ ] **Frontend:**
  - [ ] Implement/verify a shared `generateMetadata()` pattern (Next.js Metadata API) consumed by every page template, sourcing title/description/OG/canonical fields from the CMS/SEO Console data (Section 7) rather than hardcoding
  - [ ] Implement JSON-LD structured data components per content type (`ProductJsonLd`, `RecipeJsonLd`, `BreadcrumbJsonLd`, `ArticleJsonLd`) reused across all relevant templates
  - [ ] Implement dynamic `sitemap.ts` (Next.js sitemap generation) covering all published content with correct `lastModified`/`changeFrequency`/`priority`
  - [ ] Implement/verify `robots.ts` correctly scoping allowed/disallowed paths
  - [ ] Implement a custom 404 page and verify the SEO Console's redirect rules (Section 7) resolve correctly at the middleware/routing level

- [ ] **Service/Backend:**
  - [ ] Confirm the SEO fields defined per product/recipe/blog entity (Section 5: "each product carries... SEO fields") are fully wired from database through service layer to the page metadata, with sensible fallbacks when a field is left empty by a content editor

- [ ] **Validation:**
  - [ ] Add a Zod schema (or CI script) validating SEO field length constraints (title/description char limits) at the point of admin content save, giving SEO Specialists real-time feedback in the SEO Console (Section 7) rather than discovering issues post-publish

- [ ] **Testing:**
  - [ ] Run an automated site crawl (e.g. Screaming Frog or an equivalent crawler script) against a staging deploy to catch duplicate/missing titles-descriptions, broken links, and orphaned pages
  - [ ] Validate structured data for one representative page of each content type using Google's Rich Results Test / Schema.org validator, with zero errors and documented handling of any warnings
  - [ ] Validate Open Graph/Twitter Card rendering via a social share debugger for product, recipe, blog, and homepage
  - [ ] Re-run PageSpeed Insights / Core Web Vitals checks on the key page set and cross-reference against STORY-066 baseline results
  - [ ] Execute the full cross-epic regression test pass (manual exploratory + existing Playwright e2e suites from Epics 01–08) and log defects by severity (P0–P3), blocking launch on any P0/P1
  - [ ] Execute cross-browser test pass (Chrome, Firefox, Safari, Edge — latest two versions each) on the critical customer journey
  - [ ] Execute cross-device test pass (representative iOS/Android/tablet/desktop viewports) on the critical customer journey

- [ ] **Documentation:**
  - [ ] Publish an SEO Validation Report (structured data results, meta tag coverage, sitemap/robots status, Core Web Vitals for SEO)
  - [ ] Publish a Final QA Regression Report (defect log by severity, cross-browser/cross-device matrix results, resolution status)
  - [ ] Produce the combined Epic 09 sign-off checklist consolidating STORY-065/066/067/068 results as the gating artifact for Epic 10 Production Launch

## Dependencies
- All prior epics (01-08) — this epic validates and hardens what has been built, it runs continuously alongside feature work per blueprint Section 8's mandatory PR validation gates, and again as a dedicated pass before Epic 10 Production Launch
- STORY-066 (Performance Optimization) — Core Web Vitals baselines established there are re-validated here as an SEO ranking factor
- STORY-051 (SEO Console, Epic 07) — this story validates the output of the SEO Console's per-page fields, redirects, and schema tooling

## Out of Scope
- Building the SEO Console admin UI itself (belongs to Epic 07 STORY-051); this story validates its output
- Off-page SEO (backlink strategy, content marketing calendar, paid search) — outside engineering scope
- Multi-language/hreflang SEO (multi-currency/multi-language scope for launch is an open item per blueprint Section 10, not yet confirmed)
- Production Google Search Console / Bing Webmaster Tools account provisioning and domain verification (belongs to Epic 10 — Production Launch)

## References
- `docs/blueprint.md` Section 4 (Site Structure / Information Architecture)
- `docs/blueprint.md` Section 5 (Core Feature Set — per-product SEO fields)
- `docs/blueprint.md` Section 6 (Non-Functional Principles — Performance, Core Web Vitals)
- `docs/blueprint.md` Section 7 (Admin Console — SEO Console module)
- `docs/blueprint.md` Section 8 (Development Governance — mandatory PR validation gates)
- `docs/blueprint.md` Section 9 item 9 (Quality & Security), item 10 (Production Launch)
- `docs/blueprint.md` Section 10 (Open Items — multi-currency/multi-language scope)
