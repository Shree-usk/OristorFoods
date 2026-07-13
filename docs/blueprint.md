# Oristor Digital Experience Platform (ODEP) — Project Blueprint

> Condensed from the 291-page Master Product Requirements & Engineering
> Specification (OFP-BP-Final.pdf). This file captures what a coding agent
> needs to start and stay on track. The original PDF remains the full
> source of truth for detailed acceptance criteria — treat this as the
> working summary, not a replacement.

---

## 1. Project Overview

- **Project:** Project ORSTOR FOODS™
- **Client:** Oristor Food Products (Pvt) Ltd
- **Platform:** Oristor Digital Experience Platform (ODEP)
- **Type:** Enterprise digital commerce & brand experience platform
- **Industry:** Premium Sri Lankan food — manufacturing, retail, export, e-commerce, food education

**Vision:** Become the world's most trusted digital destination for authentic Sri Lankan food by combining premium e-commerce, culinary education, customer engagement, enterprise operations, and AI personalization in one platform.

**Mission:** Enable Oristor to expand globally while preserving Sri Lankan food heritage through technology and enterprise-grade digital experience.

**Business positioning:** Oristor sells heritage, trust, quality, authenticity, knowledge, community, and experience — not just food. It should compete with premium international food brands on digital experience, not only product quality.

**Strategic pillars:** Premium Products · Authentic Sri Lankan Heritage · Digital Customer Experience · Global Export Growth · AI & Data Intelligence · Operational Excellence

**Target markets:** Primary — Sri Lanka. Secondary — Sri Lankan diaspora. Tertiary — international food enthusiasts, importers, supermarkets, distributors, restaurants, hotels.

**Key personas:** Home Cook, Busy Professional, Sri Lankan Expat, Gourmet Food Enthusiast, Distributor, Executive (needs dashboards/insights).

**12-month success metrics:** increased direct online revenue, higher returning-customer rate, higher average order value, strong loyalty program engagement, more export enquiries, excellent Core Web Vitals, enterprise-grade UX.

---

## 2. Brand Identity

- **Name:** ORISTOR — **Tagline:** "Feel the Difference"
- **Brand values:** Authenticity, Integrity, Premium Quality, Innovation, Customer First, Food Safety, Sustainability, Respect, Continuous Improvement, Community
- **Tone of voice:** Warm, professional, confident, educational, friendly, positive, respectful. Short paragraphs, simple English, active voice, minimal jargon, benefits before features.

**Color system:**
| Role | Name | Hex |
|---|---|---|
| Primary background | Ivory | `#FAF7F2` |
| Primary text | Charcoal | `#2F2B2A` |
| Premium accent | Oristor Gold | `#CDAF52` |
| Primary CTA | Chilli Red | `#B22222` |
| Success | Leaf Green | `#2E8B57` |
| Supporting | Cream | `#FFFDF9` |
| Supporting | Warm Beige | `#F2ECE4` |
| Supporting | Light Gold | `#E8D9A8` |
| Supporting | Stone Grey | `#8A817C` |
| Supporting | Soft Border | `#E5DED5` |

**Typography:**
- Heading font: Cormorant Garamond
- Body font: Inter
- Number font: Inter SemiBold
- Scale: Hero 64px / H1 48px / H2 36px / H3 30px / H4 24px / Body 16px / Small 14px / Caption 12px

---

## 3. Technology Stack

**Frontend**
- Framework: Next.js 16.2.10 (App Router), Server Components by default, Client Components only where interactivity is required
- Language: TypeScript (strict mode)
- Styling: Tailwind CSS v4
- Components: Shadcn UI
- Animation: Framer Motion
- Icons: Lucide React
- Forms: React Hook Form + Zod
- State: TanStack Query (server state) + Zustand (client state)
- Images: Next/Image · Fonts: Next Font · Charts: Recharts
- Testing: Vitest (unit) + Playwright (e2e)

**Backend**
- Runtime: Node.js LTS
- Framework: Next.js 15 Route Handlers
- Language: TypeScript (strict mode)
- ORM: Prisma ORM
- Database: PostgreSQL
- Auth: NextAuth
- Validation: Zod
- Caching: Redis (planned/future)
- Queue: BullMQ (planned/future)

**Architecture principles:** Service Layer pattern, Dependency Injection, modular development, event-driven processing, enterprise security standards. The Service Layer must never directly expose raw database objects; database access is isolated in a Repository layer.

---

## 4. Site Structure / Information Architecture

```
Homepage
├── Products (Categories, Product Details, Reviews, Compare, Search)
├── Recipes (Categories, Details, Video Recipes, Cooking Tips)
├── Food Academy
├── About Us
├── Sustainability
├── Export
├── Blog
├── Contact
├── Customer Portal
├── Rewards Club
├── Referral Programme
├── Wishlist
├── Shopping Cart
└── Checkout
```

**Primary nav (desktop):** Home, Products, Recipes, Food Academy, Export, Blog, About, Contact, Search, Wishlist, Rewards, Account, Cart
**Primary nav (mobile):** Home, Products, Recipes, Search, Rewards, Account, Menu, Cart

**Homepage sections (in order):** Hero Banner → Featured Categories → Why Choose Oristor → Best Selling Products → Featured Recipes → Product Collections → Food Academy → Customer Reviews → Export Solutions → Rewards Club → Instagram Gallery → Newsletter → Footer

**Customer journey:** Visitor → Homepage → Browse Products → View Product → Read Story → View Recipes → Add to Cart → Checkout → Earn Rewards → Leave Review → Refer Friends → Become Loyal Customer

**Product Detail Page must include:** gallery + zoom, product story, ingredients, nutrition, benefits, serving suggestions, recipes using the product, customer reviews, Q&A, related/recently viewed products, share buttons, availability, delivery info, reward points earned.

---

## 5. Core Feature Set

**Customer management:** registration, login, profiles, addresses, wishlists, rewards

**Commerce:** catalogue, search, cart, checkout, payments, orders, shipping. Catalogue supports products, categories, collections, brands, bundles, gift packs, seasonal/limited-edition items. Each product carries SKU, barcode, slug, images/videos, nutrition, ingredients, allergens, certifications, SEO fields, and reward points.

**Pricing engine:** standard, sale, campaign, customer-group, wholesale, distributor, export, private-label, and volume-discount pricing models.

**Commerce lifecycle:** Browse → Search/Filter → Product Detail → Add to Cart/Wishlist → Checkout → Payment → Order Confirmation → ERP Sync → Warehouse Processing → Shipment → Delivery → Review → Rewards → Referral → Repeat Purchase

**Inventory:** multiple warehouses, stock levels, batch numbers, expiry dates, reservations, transfers, adjustments, cycle counts, safety stock, reorder levels.

**Content:** recipes, Food Academy, blog, product stories, videos, downloads

**Community:** reviews, ratings, Q&A, referrals, loyalty, achievements

**Enterprise (internal):** CMS, CRM, analytics, export portal, ERP integration, executive dashboard

**AI features:** recommendations, smart search, recipe assistant, customer support assistant, business insights, demand forecasting (future)

---

## 6. Non-Functional Principles

Every decision must satisfy: **Authenticity, Simplicity, Trust, Premium Quality, Performance, Security, Accessibility, Scalability** (support global expansion without redesign).

**Technical success targets:** Lighthouse score >95, API response <300ms, 99.9% availability, zero critical vulnerabilities, high test coverage, fast build pipeline.

---

## 7. Admin / Back-Office Console (100% No-Code Content & Operations Control)

This is the operational headquarters of the whole platform. Every business function
listed below is meant to be manageable by non-technical staff with **no developer
involvement** — this is a first-class module, not an afterthought bolted on later.

**Access:** secure web-based portal, role-based permissions (Super Administrator,
Administrator, Marketing Manager, Sales Manager, Finance Manager, Production
Manager, Warehouse Manager, Customer Support, Export Manager, Content Editor,
SEO Specialist, Viewer). Granular per-module permission assignment (view, edit,
delete, approve, export, audit).

**Admin dashboard (landing screen):** today's revenue/orders, live visitors, pending
reviews/questions/comments, low stock alerts, reward redemptions, referral signups,
export enquiries, support tickets, failed payments, ERP sync status, system health.

**Main console modules:**
- **Products** — full CRUD, duplicate, bulk edit/import/export/publish/archive; every
  field (pricing tiers, ingredients, nutrition, images, SEO, reward points) editable
- **Media Library** — folders, tagging, search, bulk upload, compression, automatic
  WebP conversion, cropping, resizing, alt text, version history — this is where
  "manage web and project images" lives
- **Homepage Visual Builder** — drag-and-drop, no code, for every homepage section
  (hero, banners, collections, testimonials, etc.), with preview/schedule/publish
- **Recipes** — full recipe builder (steps, ingredients, nutrition, video, chef notes),
  draft → review → approval → publish workflow
- **Blog** — rich text editor, scheduling, authors, tags, comment moderation
- **Reviews** — product reviews, recipe reviews, blog/Food Academy comments;
  pending → approved → published → archived workflow; approve/reject/reply/feature/
  hide/reward-customer actions
- **Questions & Answers** — product Q&A and recipe Q&A, each with its own
  submit → notify admin → answer → approve → publish → notify customer flow
- **Orders** — status pipeline (pending → dispatched → delivered → returned),
  invoices, packing slips, shipping labels, refunds
- **Customers** — profiles, purchase/support/login history, suspend/activate,
  manual reward/coupon issuance
- **Rewards & Referrals** — campaign creation, point rules, badges, fraud monitoring
- **Marketing Console** — seasonal campaigns, email/SMS/WhatsApp campaigns,
  coupons, landing pages, **popup campaigns**, referral/reward campaigns
- **SEO Console** — per-page SEO fields, redirects, schema, bulk SEO editing
- **Navigation & Menus** — header/mega menu/footer/mobile menu, drag-to-reorder
- **CMS workflow** — Draft → Marketing Review → SEO Review → Approval →
  Publish → Archive, with version history and rollback
- **System Settings** — company info, currencies, languages, taxes, **shipping**,
  payment methods, email/notification templates, reward/referral rules, feature flags
- **ERP Integration Console** — sync queue monitoring, failed job retry
- **Users, Roles, Audit Logs, System Health**

### ⚠️ Gap: Zone-wise delivery charges
The source spec only says shipping zones are "configurable" and lists "Shipping"
generically under System Settings — it does **not** spec a dedicated CRUD workflow
the way it does for products, recipes, or reviews. Before building this, define it
explicitly, e.g.:
- Admin can create/edit/delete delivery zones (by postcode, city, district, or country)
- Each zone has its own rate table (flat rate, weight-based, or order-value-based)
- Zones support free-shipping thresholds and campaign overrides
- Zone assignment shown at checkout based on customer's delivery address

Treat this as its own module — **Delivery Zone Management** — under System
Settings / Shipping, with the same level of admin control as Products or Recipes.

---

## 8. Development Governance & Coding Standards

- Methodology: Agile/iterative — every sprint produces deployable software
- Mandatory workflow per feature: Requirements → Architecture → Database → API → Frontend → Backend → Validation → Testing → Documentation → Deployment
- Coding standards: strict TypeScript, reusable components/services/hooks/utilities, no duplicate logic, clean architecture, SOLID principles, meaningful comments, consistent naming
- Every Pull Request must pass automated validation before merge (build, TypeScript, lint, unit + integration tests, accessibility, performance, security, code review, docs review) before deployment proceeds
- Git: GitHub, branches = main/develop/feature/release/hotfix, Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `style:`, `perf:`, `build:`, `ci:`, `security:`, `chore:`)
- No feature is "complete" without documentation
- No undocumented requirement changes accepted

### Rules for the coding agent specifically
- Generate production-ready code — never placeholder code unless explicitly requested
- Follow the architecture exactly; use reusable components/services
- Maintain strict TypeScript; document exported functions
- Follow accessibility and SEO standards
- Avoid duplicated logic; respect business rules; follow the Oristor design system
- Workflow per module: Read spec → Understand business rules → Identify module → Generate database → Generate APIs → Generate backend → Generate frontend → Generate tests → Generate documentation → Await human review
- No implementation should skip this workflow, and no module should merge without passing the human review checklist (architecture, database, business rules, security, performance, accessibility, SEO, responsive design, testing, documentation, code quality)

---

## 9. Suggested Build Order (from the spec's sprint plan)

1. **Foundation** — Next.js project, TypeScript, Tailwind, Shadcn UI, Prisma, PostgreSQL, auth framework, folder structure, theme, env config, design tokens, repo, CI/CD. *Done when the app builds successfully.*
2. **Core UI** — navigation, homepage, footer, layout, search, responsive framework, animation framework, CMS integration. *Done when homepage is responsive and complete.*
3. **Product Platform** — products, categories, collections, search, filters, wishlist, compare, reviews, product detail. *Done when customers can browse and discover products.*
4. **Recipes & Food Academy** — recipe centre, recipe details, Food Academy, blog, downloads, videos, recipe reviews, bookmarks. *Done when customers can learn, cook, and engage with content.*
5. **Commerce Platform** — cart, checkout, payments, shipping, orders, coupons, rewards, referral program, notifications. *Done when the full purchase journey works.*
6. **Customer Platform** — dashboard, profile, wishlist, reward wallet, referral dashboard, saved recipes, addresses, order history, support, settings. *Done when customer self-service is complete.*
7. **Enterprise Platform** — CMS, CRM, export portal, marketing platform, SEO tools, analytics, BI, executive dashboard. *Done when internal business users can manage the platform independently.*
8. **AI Platform** — AI search, customer assistant, recipe assistant, recommendations, executive/marketing AI, personalization, knowledge base. *Done when AI modules are operational and integrated.*
9. **Quality & Security** — security/performance/accessibility/load/penetration testing, bug fixes, optimization, SEO validation. *Done when the platform meets production quality standards.*
10. **Production Launch** — deployment, domain, SSL, monitoring, backups, analytics, ERP integration, training, documentation, go-live.

---

## 10. Open Items to Confirm Before/During Build

The source spec left these generic or unspecified — confirm with the client before implementing:
- Exact payment gateway provider(s) (spec only says "Payment Gateway" generically)
- Shipping/carrier integrations
- ~~Zone-wise delivery charge structure~~ — **confirmed:** zones are
  defined by city; rate model (flat/weight/value-based) varies per zone;
  free-shipping threshold is global, not per zone; marketing campaigns can
  temporarily override a zone's rate. See `.claude/skills/delivery-zone-pricing/SKILL.md`
  for the full model.
- ERP system being integrated with (spec assumes ERP sync exists but doesn't name the system)
- Multi-currency scope for launch vs. future
- Hosting/cloud provider specifics (Part 15 of the source PDF covers DevOps/CI/CD in more depth if needed)

---

## 11. Where to Go Deeper

This file intentionally leaves out page-by-page functional specs, full database schemas, detailed security/compliance chapters, and CMS/marketing module details — all present in the original 291-page PDF. When a task needs that level of detail (e.g., "build the checkout page exactly to spec," or "implement the loyalty points formula"), pull the relevant section from the source document rather than guessing.
