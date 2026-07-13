# Recommended Folder Structure

This is the layout to set up before you start Sprint 1. You don't need to
create every folder up front — Claude Code will create files as it builds
features — but this is the target shape so things land in the right place
from the start.

```
oristor-web/
├── CLAUDE.md                      ← project instructions (Claude reads this every session)
├── .claude/
│   └── skills/                    ← reusable workflows Claude pulls in automatically
│       ├── add-product-page/
│       │   └── SKILL.md
│       ├── add-recipe/
│       │   └── SKILL.md
│       ├── admin-console-module/
│       │   └── SKILL.md
│       └── delivery-zone-pricing/
│           └── SKILL.md
│
├── docs/
│   ├── blueprint.md                ← condensed spec (source of truth for scope)
│   ├── folder-structure.md          ← this file
│   └── architecture-decisions.md      ← optional: log key decisions as you make them
│
├── prisma/
│   ├── schema.prisma                 ← database models
│   └── migrations/                    ← auto-generated, don't hand-edit
│
├── src/
│   ├── app/                            ← Next.js App Router — pages & routes
│   │   ├── (storefront)/                  ← customer-facing route group
│   │   │   ├── page.tsx                      ← homepage
│   │   │   ├── products/
│   │   │   ├── recipes/
│   │   │   ├── food-academy/
│   │   │   ├── blog/
│   │   │   ├── cart/
│   │   │   ├── checkout/
│   │   │   └── account/
│   │   ├── (admin)/                       ← admin console route group
│   │   │   ├── dashboard/
│   │   │   ├── products/
│   │   │   ├── recipes/
│   │   │   ├── blog/
│   │   │   ├── reviews/
│   │   │   ├── questions/
│   │   │   ├── orders/
│   │   │   ├── customers/
│   │   │   ├── marketing/
│   │   │   ├── settings/
│   │   │   └── media-library/
│   │   └── api/                            ← Route Handlers (call Services, never Prisma directly)
│   │
│   ├── components/
│   │   ├── ui/                              ← Shadcn UI primitives
│   │   ├── storefront/                       ← customer-facing components
│   │   └── admin/                             ← admin console components
│   │
│   ├── services/                            ← business logic (Service Layer)
│   │   ├── product.service.ts
│   │   ├── recipe.service.ts
│   │   ├── order.service.ts
│   │   ├── shipping.service.ts
│   │   └── ...
│   │
│   ├── repositories/                        ← the ONLY place Prisma is called directly
│   │   ├── product.repository.ts
│   │   ├── recipe.repository.ts
│   │   └── ...
│   │
│   ├── lib/                                 ← shared utilities, config, auth setup
│   ├── hooks/                                ← shared React hooks
│   ├── types/                                 ← shared TypeScript types
│   └── validation/                             ← Zod schemas
│
├── public/                                  ← static assets
├── tests/
│   ├── unit/
│   └── e2e/                                    ← Playwright tests
│
├── .env.example
├── package.json
└── tsconfig.json
```

## Why this shape

- **`.claude/skills/`** — keeps recurring workflows (like "add a product
  page") consistent every time, instead of Claude re-deriving the pattern
  from scratch each session.
- **`(storefront)` / `(admin)` route groups** — Next.js route groups let you
  share layouts and enforce different auth rules for customer-facing pages
  vs. the admin console, without them sharing a URL prefix.
- **`services/` + `repositories/` split** — matches the Service Layer /
  Repository pattern called for in the blueprint. Route handlers and
  components should never import Prisma directly; they call a service,
  which calls a repository. This keeps business logic testable and swaps
  the database layer out without touching the rest of the app.
- **`docs/`** — keeps the blueprint and any architecture decisions
  versioned alongside the code, so context doesn't live only in someone's
  head or a separate PDF.

## Getting started

1. Create the repo, add `CLAUDE.md` and `.claude/skills/` at the root.
2. Run `npx create-next-app@latest` inside it (TypeScript, Tailwind, App
   Router — say yes to all three).
3. Add Prisma: `npm install prisma --save-dev && npx prisma init`.
4. Ask Claude Code to scaffold the folders under `src/` per this structure
   before writing the first feature.
