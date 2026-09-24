import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Optional pool cap. The local `prisma dev` server is PGlite, which supports
// only one connection at a time; concurrent queries (e.g. the PDP's
// Promise.all) open several pool connections and crash it. Set
// DATABASE_POOL_MAX=1 in the local .env. Unset (e.g. CI's real Postgres)
// keeps pg's default pool size. See docs/architecture-decisions.md.
const poolMax = process.env.DATABASE_POOL_MAX ? Number.parseInt(process.env.DATABASE_POOL_MAX, 10) : undefined;

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  ...(poolMax ? { max: poolMax } : {}),
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
