# STORY-072: ORISTOR Contact Us — Premium Contact & Business Enquiry Page

**Status:** Done
**Epic:** 11 — Missed Stories
**Priority:** High
**Persona(s):** Prospective Customer, Export/Wholesale Buyer, Existing Customer, Admin/Support Team

**Numbering note:** the user's own source doc self-labeled this "STORY-069," which collides
with the already-shipped `STORY-069-deployment-infrastructure-launch.md` (Epic 10). It also
referenced the existing accessibility (STORY-067) and performance (STORY-066) stories by number
correctly — only the self-assigned number was wrong. Renumbered to **STORY-072**, the next free
number after STORY-071 (Customer Group Pricing Context, already shipped). Original instructions
preserved verbatim at `docs/stories/11-missed-stories/Contact us — Premium ORIST.txt`.

## User Story
As a prospective customer or export/wholesale buyer, I want a premium, emotionally engaging way to contact ORISTOR that reflects the brand's quality, so that reaching out feels like the start of a real relationship, not filling out a generic web form.
As an export or distributor buyer, I want a contact path that captures my business context (company, country, product interest, volume), so that ORISTOR's team can follow up with the right information without a second round of emails.
As an admin/support team member, I want every enquiry — general, product, support, wholesale, or export — triaged in one place I already use, so that nothing falls through the cracks and I'm not checking two separate inboxes for the same kind of lead.

## Description
Replaces the currently non-existent `/contact-us` page (no Contact route exists anywhere in
this codebase today) with a premium, editorial-style contact and enquiry experience, per the
user's detailed design brief. The page serves two audiences at once: a consumer-facing contact
channel, and a B2B/export lead-generation surface.

**Critical architectural finding from pre-implementation research, resolved before this plan
was written:** this codebase already has a mature, fully-built **Export Portal** (STORY-058) —
`ExportEnquiry`/`ExportEnquiryNote` models, a full admin pipeline (`status`: New → InDiscussion
→ Quoted → Won → Lost, admin assignment, internal notes, reply-to-enquirer, and conversion to a
real `DistributorAccount` on Won), live today at `/export` → `/admin/export`. Its form fields
(`companyName`, `contactName`, `contactEmail`, `contactPhone`, `country`, `productsOfInterest`,
`volumeEstimate`, `message`) are nearly identical to what this story's own brief asks for under
"Export / International Business." Per this story's own explicit instruction ("reuse existing...
do not duplicate business logic"), **the Contact page's "Export / International Business"
enquiry type submits into the existing `ExportEnquiry` pipeline, not a new table** — see Scope
Decisions below. A new, simpler `ContactEnquiry` model covers every other enquiry type (General,
Product, Customer Support, Wholesale, Distributor/Dealer, Retail Partnership, Food Service/
Hospitality, Media/Marketing, Careers, Other).

## Design Direction (from the original brief, preserved)
A large editorial hero (~60-75vh) with an emotional headline — the user's recommended copy:

> **Let's talk about good food.**
> From authentic Sri Lankan flavours to international partnerships, we'd love to hear from you.

— followed by a conversational enquiry form (not a bare Name/Email/Message grid), real
contact information (address, phone, email, business hours — **never invented**; sourced from
whatever is actually configured in this project's content, flagged as a content gap if missing),
a location section with an external "Get Directions" map link, and a social/direct-contact
section using only officially configured channels. Visual personality: premium, authentic Sri
Lankan, warm, modern, minimal, confident, international/export-ready — inspired by premium
Awwwards contact-page patterns in spirit only, never copying their layout, artwork, or text.
Avoid: generic Bootstrap-style forms, boxed cards everywhere, excessive borders/gradients/icons,
crowded layouts, stock corporate imagery.

## Acceptance Criteria
- [x] Premium ORISTOR Contact page implemented at `/contact-us`, working on desktop/tablet/mobile
- [x] Large editorial hero (~60-75vh) with the emotional headline, subtle product imagery, using existing brand colors/typography — no generic corporate contact-page feel
- [x] Real contact information displayed (address, phone, email, business hours) sourced from actual configured project content — never invented; any genuinely missing field is flagged as a content/configuration gap, not fabricated
- [x] Conversational, large-field enquiry form (not a bare Name/Email/Message grid) with an enquiry-type selector covering: General, Product, Customer Support, Wholesale, Distributor/Dealer, Export/International Business, Retail Partnership, Food Service/Hospitality, Media/Marketing, Careers, Other
- [~] Selecting Export/International Business dynamically reveals the additional business fields (company, country, business type, product interest, estimated requirement) and submits into the **existing `ExportEnquiry` pipeline** (STORY-058), not a new table — a separate "Website" field was not added, since neither this new flow nor the existing `ExportEnquiry`/`CreateExportEnquiryInput` it submits into has a website field; a website mention fits naturally in Company name or the message instead of inventing a new column on a shared, already-shipped model
- [x] Selecting Wholesale/Distributor dynamically reveals its own additional fields (company, country/region, business type, expected order volume, products interested in) and is stored on the new `ContactEnquiry` model
- [x] Full form UX: inline validation, required-field indicators, email/phone validation, loading/disabled-during-submit state, success state, clear error messages, keyboard accessibility, mobile-friendly controls
- [x] Success state shows a real thank-you message with "Back to ORISTOR" and "Explore our products" actions
- [x] Non-export enquiries persisted to a new `ContactEnquiry` model (PostgreSQL via Prisma) with a `status` lifecycle (New/InProgress/Responded/Closed/Spam)
- [x] Admin console at `/admin/contact-enquiries`: list, search, filter by enquiry type/status, view detail, change status, mark responded, close — gated via the existing RBAC permission system, not a new one; also surfaced as a new Contact Enquiries card on the existing Admin Dashboard (STORY-039), mirroring the Export Enquiries card, for discoverability
- [x] Email notifications reuse the existing notification/email architecture (`sendTransactionalEmail`): a confirmation to the submitter, and a notification to ORISTOR's configured enquiry email containing name/email/phone/enquiry type/company/country/message/timestamp — for every enquiry type, Export included, without modifying `export-enquiry.service.ts` itself
- [x] Anti-spam/security: server-side Zod validation, rate limiting (reusing `src/lib/rate-limit.ts`), a honeypot mirroring the blog comment form's exact pattern, no HTML injection, no internal error detail ever exposed to the submitter
- [x] Location section with an external "Get Directions" map link (no heavy embedded map), and a social/direct-contact section using only officially configured channels — never invented URLs
- [x] Mobile layout order: Hero → Contact info → Enquiry type → Form → Location → Social → Footer, with comfortable single-column form fields (no cramped two-column desktop form squeezed onto mobile)
- [x] Subtle, purposeful motion (hero text reveal, section reveal on scroll) via the existing `ScrollReveal`/Framer Motion setup, respecting `prefers-reduced-motion` automatically
- [x] SEO: title, meta description, canonical URL, a single proper `<h1>`, semantic heading hierarchy, Organization structured data via the existing `JsonLdScript` component
- [x] WCAG AA: labels, keyboard navigation, visible focus states, accessible error messaging, accessible select controls, correct heading hierarchy, `aria-live` on the form, confirmed via a real axe check (zero critical/serious violations)
- [x] Performance: no heavy embedded map, minimal JS, no unnecessary third-party scripts
- [x] Unit tests, API/integration tests, and an e2e contact-submission test added
- [x] Production build passes; existing pages and navigation are not broken

## Scope Decisions (made before implementation, per the brief's own "wait for approval" instruction)
- **Export enquiries route into the existing `ExportEnquiry` pipeline, not a new table** — avoids duplicating STORY-058's already-built status workflow, admin assignment, notes, and Won→DistributorAccount conversion. The Contact page's "Export / International Business" option becomes another entry point into that same system, alongside the existing `/export` page. `export-enquiry.service.ts::submitEnquiry` is called directly, unmodified — an established pattern in this codebase (`checkout.service.ts` alone imports from seven sibling services the same way).
- **This is not a CRM** — per the brief's own instruction, `ContactEnquiry` stays a simple inbox-style model (status lifecycle only), reusing existing audit-log/notification/RBAC infrastructure rather than introducing any new cross-cutting system.
- **No invented contact details.** `system-settings.service.ts::getResolvedCompanyInfo()` (STORY-054) was already the real, admin-manageable source for address/phone/email, falling back to a static placeholder explicitly marked "replace before production launch" — reused as-is. No `businessHours` field existed anywhere; one was added to `CompanySetting` (additive, optional) rather than inventing hours or silently dropping a section the brief explicitly asked for — the page omits that line entirely until an admin sets it. `CompanySetting.socialLinks` already existed as an admin field but was deliberately never wired to the storefront (a real Server→Client icon-serialization constraint from STORY-052) — the Contact page's social section renders it as plain text/href links, with no icon component crossing that boundary, sidestepping the constraint rather than solving it.
- **New `AdminModule.ContactEnquiries` RBAC module** — required seeding beyond the schema enum value itself: `prisma/seed-admin.ts`'s `ALL_MODULES` array and `customer_support`'s `homeModules` entry both needed updating (confirmed via a Plan-agent validation pass — the enum value alone grants nothing). A one-off dev-environment backfill script granted the equivalent `RolePermission` rows to already-seeded roles, since re-running the non-idempotent `seedAdmin()` against an already-seeded database fails on a duplicate `Role.key` — a pre-existing limitation of every prior story that added an `AdminModule` value, not unique to this one.
- **A new Contact Enquiries card on the existing Admin Dashboard** (STORY-039), mirroring the existing Export Enquiries card exactly (same `permissions.has(permissionKey(...))`-gated pattern in `admin-dashboard.service.ts`) — added for discoverability, since this codebase's admin console has no persistent sidebar; the Dashboard's card grid is the only way an admin finds a console page without typing its URL directly.

## Dependencies
- STORY-058 (Export Portal) — the `ExportEnquiry` pipeline this story routes export-type submissions into
- Existing notification/email architecture (`src/services/notification/`)
- Existing RBAC (STORY-038) — admin console gating
- Existing SEO system and design tokens (Cinnamon design system)
- STORY-066 (Performance), STORY-067 (Accessibility) — this page should already meet their bars at ship time, not require rework later

## Out of Scope
- A full CRM (lead scoring, pipelines beyond the simple status lifecycle, marketing automation)
- A separate Wholesale/Distributor landing page (kept inside the Contact enquiry system per the brief)
- Inventing contact information, social URLs, or business hours not already configured in the project

## References
- Original brief: `docs/stories/11-missed-stories/Contact us — Premium ORIST.txt`
- `docs/blueprint.md` (design system, SEO, Admin Console Principle)
