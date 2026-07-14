# Repositories

This is the **only** layer allowed to import `@/lib/db` (Prisma). No other
layer — services, route handlers, or components — may import Prisma or
`@/lib/db` directly.

- One file per aggregate/model, e.g. `product.repository.ts`, `order.repository.ts`.
- Repositories return plain data (or Prisma-generated types), not framework-specific shapes.
- No business logic here — that belongs in `src/services/`. A repository's job is persistence only: reads, writes, and query composition.
