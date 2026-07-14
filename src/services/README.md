# Services

Business logic lives here. Route handlers and Server Components call
services — never `src/repositories/` or Prisma directly.

- One file per domain, e.g. `product.service.ts`, `order.service.ts`.
- A service composes one or more repositories, applies business rules
  (pricing, validation, authorization checks), and returns
  application-shaped results.
- Services should be framework-agnostic where possible (no `NextRequest`/
  `NextResponse` — those are parsed/built in the route handler that calls
  the service).
